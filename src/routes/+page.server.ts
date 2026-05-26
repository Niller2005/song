import { lookupSong } from '$lib/server/lookup';
import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';

export const actions = {
	lookup: async ({ request }) => {
		const formData = await request.formData();
		const url = formData.get('url');
		if (!url || typeof url !== 'string') {
			return fail(400, { error: 'Please enter a URL', url: '' });
		}
		try {
			const result = await lookupSong(url);
			return { success: true as const, result, url };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to look up song';
			return fail(502, { error: message, url });
		}
	}
} satisfies Actions;
