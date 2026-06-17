import { auth } from '$lib/auth';
import { getHistory } from '$lib/server/listening-history';
import { db } from '$lib/server/db';
import { account } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, url }) => {
	const apiKey = url.searchParams.get('key');
	const isApiKeyValid = env.NOW_PLAYING_API_KEY && apiKey === env.NOW_PLAYING_API_KEY;

	let userId: string | null = null;

	if (isApiKeyValid) {
		const accounts = await db.query.account.findMany({
			where: eq(account.providerId, 'spotify'),
			columns: { userId: true },
			limit: 1
		});
		if (accounts.length === 0) {
			return new Response(JSON.stringify([]), {
				headers: { 'Content-Type': 'application/json' }
			});
		}
		userId = accounts[0].userId;
	} else {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
		}
		userId = session.user.id;
	}

	const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100);
	const history = await getHistory(userId!, limit);

	return new Response(JSON.stringify(history), {
		headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
	});
};
