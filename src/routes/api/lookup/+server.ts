import { json, error } from '@sveltejs/kit';
import { lookupSong } from '$lib/server/lookup';
import type { RequestHandler } from './$types';

const CACHE_HEADERS = {
	'Cache-Control': 'public, max-age=300, s-maxage=3600'
} as const;

export const GET: RequestHandler = async ({ url }) => {
	const inputUrl = url.searchParams.get('url');
	if (!inputUrl) {
		return error(400, 'Missing "url" query parameter');
	}

	try {
		const result = await lookupSong(inputUrl);
		return json(result, { headers: CACHE_HEADERS });
	} catch (err) {
		console.error('Lookup failed:', err);
		const message = err instanceof Error ? err.message : 'Unknown error';
		return error(502, `Failed to look up song: ${message}`);
	}
};
