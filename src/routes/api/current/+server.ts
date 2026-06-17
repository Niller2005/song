import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { recordPlay } from '$lib/server/listening-history';
import { findYouTubeUrl } from '$lib/server/youtube-lookup';
import type { RequestHandler } from './$types';

interface NowPlayingResponse {
	isPlaying: boolean;
	title: string | null;
	artist: string | null;
	album: string | null;
	albumArt: string | null;
	progress: number | null;
	duration: number | null;
	spotifyUrl: string | null;
	spotifyTrackId: string | null;
	youtubeUrl: string | null;
	notConnected?: boolean;
}

const NOT_PLAYING: NowPlayingResponse = {
	isPlaying: false,
	title: null,
	artist: null,
	album: null,
	albumArt: null,
	progress: null,
	duration: null,
	spotifyUrl: null,
	spotifyTrackId: null,
	youtubeUrl: null
};

async function getSpotifyUserId(): Promise<string | null> {
	const accounts = await db.query.account.findMany({
		where: eq(account.providerId, 'spotify'),
		columns: { userId: true },
		limit: 1
	});
	return accounts.length > 0 ? accounts[0].userId : null;
}

export const GET: RequestHandler = async ({ request }) => {
	const userId = await getSpotifyUserId();
	if (!userId) {
		return new Response(JSON.stringify({ ...NOT_PLAYING, notConnected: true }), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	try {
		const accessTokenResult = await auth.api.getAccessToken({
			body: {
				providerId: 'spotify',
				userId
			},
			headers: request.headers
		});

		if (!accessTokenResult?.accessToken) {
			return new Response(JSON.stringify({ ...NOT_PLAYING, notConnected: true }), {
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
			});
		}

		const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
			headers: { Authorization: `Bearer ${accessTokenResult.accessToken}` }
		});

		if (res.status === 204) {
			return new Response(JSON.stringify(NOT_PLAYING), {
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
			});
		}

		if (!res.ok) {
			return new Response(JSON.stringify(NOT_PLAYING), {
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
			});
		}

		const data = await res.json();

		if (!data.item) {
			return new Response(JSON.stringify(NOT_PLAYING), {
				headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
			});
		}

		const track = data.item;
		const spotifyTrackId: string | null = track.id ?? null;
		const spotifyUrl = track.external_urls?.spotify ?? null;
		const result: NowPlayingResponse = {
			isPlaying: data.is_playing ?? false,
			title: track.name ?? null,
			artist: track.artists?.map((a: { name: string }) => a.name).join(', ') ?? null,
			album: track.album?.name ?? null,
			albumArt: track.album?.images?.[0]?.url ?? null,
			progress: data.progress_ms ?? null,
			duration: track.duration_ms ?? null,
			spotifyUrl,
			spotifyTrackId: track.id ?? null,
			youtubeUrl: await findYouTubeUrl(spotifyUrl)
		};

		if (result.isPlaying && result.title && spotifyTrackId) {
			recordPlay(userId!, {
				title: result.title,
				artist: result.artist ?? 'Unknown',
				album: result.album,
				albumArt: result.albumArt,
				spotifyUrl: result.spotifyUrl,
				spotifyTrackId
			}).catch(() => {});
		}

		return new Response(JSON.stringify(result), {
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
		});
	} catch {
		return new Response(JSON.stringify(NOT_PLAYING), {
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
		});
	}
};
