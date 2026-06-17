import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { account, songRequests } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
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
): Promise<{ userId: string } | null> {
	const apiKey = url.searchParams.get('key');
	const isApiKeyValid = env.NOW_PLAYING_API_KEY && apiKey === env.NOW_PLAYING_API_KEY;

	if (isApiKeyValid) {
		const userId = await getUserIdFromApiKey();
		if (!userId) return null;
		return { userId };
	}

	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return null;
	return { userId: session.user.id };
}

interface SongRequestResponse {
	id: string;
	title: string;
	artist: string;
	albumArt: string | null;
	spotifyUrl: string | null;
	spotifyTrackId: string | null;
	status: 'pending' | 'playing' | 'played';
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

export const PATCH: RequestHandler = async ({ params, request, url }) => {
	const auth_ = await authenticate(request, url);
	if (!auth_) {
		return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
	}

	const reqRow = await db.query.songRequests.findFirst({
		where: eq(songRequests.id, params.id)
	});

	if (!reqRow) {
		return new Response(JSON.stringify({ error: 'Request not found' }), { status: 404 });
	}

	if (reqRow.userId !== auth_.userId) {
		return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
	}

	if (reqRow.status !== 'pending') {
		return new Response(JSON.stringify({ error: 'Request is not pending' }), { status: 400 });
	}

	if (!reqRow.spotifyTrackId) {
		return new Response(JSON.stringify({ error: 'Request has no Spotify track ID' }), {
			status: 400
		});
	}

	try {
		const accessTokenResult = await auth.api.getAccessToken({
			body: { providerId: 'spotify', userId: auth_.userId },
			headers: request.headers
		});

		if (!accessTokenResult?.accessToken) {
			return new Response(JSON.stringify({ error: 'No Spotify access token available' }), {
				status: 503
			});
		}

		const queueRes = await fetch(
			`https://api.spotify.com/v1/me/player/queue?uri=spotify:track:${reqRow.spotifyTrackId}`,
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${accessTokenResult.accessToken}` }
			}
		);

		if (!queueRes.ok) {
			const body = await queueRes.text();
			return new Response(
				JSON.stringify({ error: `Spotify queue failed: ${queueRes.status} ${body}` }),
				{ status: 502 }
			);
		}

		const [updated] = await db
			.update(songRequests)
			.set({ status: 'playing' })
			.where(eq(songRequests.id, params.id))
			.returning();

		return new Response(JSON.stringify(serialize(updated)), {
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return new Response(JSON.stringify({ error: `Failed to queue: ${message}` }), {
			status: 500
		});
	}
};
