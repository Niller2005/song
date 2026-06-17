import { env } from '$env/dynamic/private';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(307, '/');
	}

	const baseUrl = env.BETTER_AUTH_URL || 'http://localhost:5173';
	const apiKey = env.NOW_PLAYING_API_KEY || '';
	const overlayUrl = apiKey ? `${baseUrl}/overlay?key=${apiKey}` : null;
	const requestUrl = apiKey ? `${baseUrl}/api/requests?key=${apiKey}` : null;

	return {
		overlayUrl,
		requestUrl,
		hasApiKey: !!apiKey
	};
};
