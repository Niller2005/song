import { getHistory } from '$lib/server/listening-history';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { findYouTubeUrl } from '$lib/server/youtube-lookup';
import type { RequestHandler } from './$types';

async function getSpotifyUserId(): Promise<string | null> {
	const accounts = await db.query.account.findMany({
		where: eq(account.providerId, 'spotify'),
		columns: { userId: true },
		limit: 1
	});
	return accounts.length > 0 ? accounts[0].userId : null;
}

export const GET: RequestHandler = async ({ url }) => {
	const userId = await getSpotifyUserId();
	if (!userId) {
		return new Response(JSON.stringify([]), {
			headers: { 'Content-Type': 'application/json' }
		});
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
	const history = await getHistory(userId, limit);

	const enriched = await Promise.all(
		history.map(async (entry) => ({
			...entry,
			playedAt: entry.playedAt.toISOString(),
			youtubeUrl: await findYouTubeUrl(entry.spotifyUrl)
		}))
	);

	return new Response(JSON.stringify(enriched), {
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
	});
};
