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
	status: 'pending' | 'queued' | 'playing' | 'played';
	requestedBy: string;
	requestedAt: string;
}

function jsonError(error: string, status: number): Response {
	return new Response(JSON.stringify({ error }), {
		status,
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
	});
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
	if (!auth_) return jsonError('Unauthorized', 401);

	const reqRow = await db.query.songRequests.findFirst({
		where: eq(songRequests.id, params.id)
	});

	if (!reqRow) return jsonError('Request not found', 404);
	if (reqRow.userId !== auth_.userId) return jsonError('Forbidden', 403);
	if (reqRow.status !== 'pending') return jsonError('Request is not pending', 400);
	if (!reqRow.spotifyTrackId) return jsonError('Request has no Spotify track ID', 400);

	try {
		const accessTokenResult = await auth.api.getAccessToken({
			body: { providerId: 'spotify', userId: auth_.userId },
			headers: request.headers
		});

		if (!accessTokenResult?.accessToken) {
			return jsonError('No Spotify access token available', 503);
		}

		const queueRes = await fetch(
			`https://api.spotify.com/v1/me/player/queue?uri=spotify:track:${reqRow.spotifyTrackId}`,
			{
				method: 'POST',
				headers: { Authorization: `Bearer ${accessTokenResult.accessToken}` }
			}
		);

		if (!queueRes.ok) {
			if (queueRes.status === 404) {
				// No active device — try activating the last available device
				const devicesRes = await fetch(
					'https://api.spotify.com/v1/me/player/devices',
					{ headers: { Authorization: `Bearer ${accessTokenResult.accessToken}` } }
				);

				if (devicesRes.ok) {
					const { devices } = await devicesRes.json();
					const device = devices?.find((d: { id: string | null }) => d.id);
					if (device) {
						await fetch('https://api.spotify.com/v1/me/player', {
							method: 'PUT',
							headers: {
								Authorization: `Bearer ${accessTokenResult.accessToken}`,
								'Content-Type': 'application/json'
							},
							body: JSON.stringify({ device_ids: [device.id], play: false })
						});

						// Retry queue on the activated device
						const retryRes = await fetch(
							`https://api.spotify.com/v1/me/player/queue?uri=spotify:track:${reqRow.spotifyTrackId}`,
							{
								method: 'POST',
								headers: { Authorization: `Bearer ${accessTokenResult.accessToken}` }
							}
						);

						if (retryRes.ok) {
							const [updated] = await db
								.update(songRequests)
								.set({ status: 'queued' })
								.where(eq(songRequests.id, params.id))
								.returning();

							return new Response(JSON.stringify(serialize(updated)), {
								headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
							});
						}
					}
				}
				return jsonError('No active Spotify device found — play something on Spotify first', 400);
			}
			return jsonError(`Spotify queue failed: ${queueRes.status}`, 502);
		}

		const [updated] = await db
			.update(songRequests)
			.set({ status: 'queued' })
			.where(eq(songRequests.id, params.id))
			.returning();

		return new Response(JSON.stringify(serialize(updated)), {
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Unknown error';
		return jsonError(`Failed to queue: ${message}`, 500);
	}
};
