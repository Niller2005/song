import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { account, songRequests } from '$lib/server/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { lookupSong } from '$lib/server/lookup';
import { providers } from '$lib/server/platforms';
import type { RequestHandler } from './$types';

function getUserIdFromApiKey(): Promise<string | null> {
	return db.query.account
		.findMany({
			where: eq(account.providerId, 'spotify'),
			columns: { userId: true },
			limit: 1
		})
		.then((accounts) => (accounts.length > 0 ? accounts[0].userId : null));
}

async function authenticate(
	request: Request,
	url: URL
): Promise<{ userId: string; userName: string } | null> {
	const apiKey = url.searchParams.get('key');
	const isApiKeyValid = env.NOW_PLAYING_API_KEY && apiKey === env.NOW_PLAYING_API_KEY;

	if (isApiKeyValid) {
		const userId = await getUserIdFromApiKey();
		if (!userId) return null;
		return { userId, userName: 'API' };
	}

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return null;
	return { userId: session.user.id, userName: session.user.name ?? 'Unknown' };
}

interface SongRequestResponse {
	id: string;
	title: string;
	artist: string;
	albumArt: string | null;
	spotifyUrl: string | null;
	spotifyTrackId: string | null;
	status: 'pending' | 'queued' | 'playing' | 'played';
	requestedBy: string;
	requestedAt: string;
}

function serialize(r: typeof songRequests.$inferSelect): SongRequestResponse {
	return {
		id: r.id,
		title: r.title,
		artist: r.artist,
		albumArt: r.albumArt,
		spotifyUrl: r.spotifyUrl,
		spotifyTrackId: r.spotifyTrackId,
		status: r.status,
		requestedBy: r.requestedBy,
		requestedAt: r.requestedAt.toISOString()
	};
}

export const GET: RequestHandler = async ({ request, url }) => {
	const auth_ = await authenticate(request, url);
	if (!auth_) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	const rows = await db.query.songRequests.findMany({
		where: eq(songRequests.userId, auth_.userId),
		orderBy: [asc(songRequests.status), desc(songRequests.requestedAt)],
		limit: 100
	});

	return new Response(JSON.stringify(rows.map(serialize)), {
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
	});
};

export const POST: RequestHandler = async ({ request, url }) => {
	const auth_ = await authenticate(request, url);
	if (!auth_) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
	}

	const inputUrl = typeof body.url === 'string' ? body.url.trim() : null;
	const manualTitle = typeof body.title === 'string' ? body.title.trim() : null;
	const manualArtist = typeof body.artist === 'string' ? body.artist.trim() : null;
	const requestedBy =
		typeof body.requested_by === 'string' ? body.requested_by.trim() : auth_.userName;

	let title: string;
	let artist: string;
	let albumArt: string | null = null;
	let spotifyUrl: string | null = null;
	let spotifyTrackId: string | null = null;

	if (inputUrl) {
		try {
			const lookup = await lookupSong(inputUrl);
			title = lookup.title;
			artist = lookup.artistName;
			albumArt = lookup.thumbnailUrl;
			const spotifyLink = lookup.platforms.find((p) => p.platform === 'spotify');
			if (spotifyLink?.url) {
				spotifyUrl = spotifyLink.url;
				const idMatch = spotifyLink.url.match(
					/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)/
				);
				spotifyTrackId = idMatch?.[1] ?? null;
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Lookup failed';
			return new Response(JSON.stringify({ error: message }), { status: 422 });
		}
	} else if (manualTitle && manualArtist) {
		title = manualTitle;
		artist = manualArtist;
		// Also search Spotify for the track
		try {
			const spotifyProvider = providers.find((p) => p.name === 'spotify');
			if (spotifyProvider?.search) {
				const result = await spotifyProvider.search(manualTitle, manualArtist);
				if (result?.url) {
					spotifyUrl = result.url;
					const idMatch = result.url.match(
						/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)/
					);
					spotifyTrackId = idMatch?.[1] ?? null;
					albumArt = result.thumbnailUrl ?? null;
				}
			}
		} catch {
			// Non-critical — request goes through without Spotify enrichment
		}
	} else {
		return new Response(JSON.stringify({ error: 'Provide a "url" or both "title" and "artist"' }), {
			status: 400
		});
	}

	const now = new Date();
	const [inserted] = await db
		.insert(songRequests)
		.values({
			userId: auth_.userId,
			requestedBy,
			title,
			artist,
			albumArt,
			spotifyUrl,
			spotifyTrackId,
			requestedAt: now
		})
		.returning();

	if (inserted.spotifyTrackId) {
		try {
			const accessTokenResult = await auth.api.getAccessToken({
				body: { providerId: 'spotify', userId: auth_.userId },
				headers: request.headers
			});

			if (accessTokenResult?.accessToken) {
				const queueRes = await fetch(
					`https://api.spotify.com/v1/me/player/queue?uri=spotify:track:${inserted.spotifyTrackId}`,
					{
						method: 'POST',
						headers: { Authorization: `Bearer ${accessTokenResult.accessToken}` }
					}
				);

				if (queueRes.ok) {
					await db
						.update(songRequests)
						.set({ status: 'queued' })
						.where(eq(songRequests.id, inserted.id));
					inserted.status = 'queued';
				}
			}
		} catch {
			// Non-critical — request still goes through as pending if queue push fails
		}
	}

	return new Response(JSON.stringify(serialize(inserted)), {
		status: 201,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
	});
};
