import { lookupSong } from '$lib/server/lookup';
import type { Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

function getPlatformPrefix(url: string): string {
	const lower = url.toLowerCase();
	if (lower.includes('spotify.com') || lower.includes('open.spotify')) return 's';
	if (
		lower.includes('apple.com') ||
		lower.includes('music.apple') ||
		lower.includes('itunes.apple')
	)
		return 'a';
	if (
		lower.includes('youtube.com') ||
		lower.includes('youtu.be') ||
		lower.includes('music.youtube')
	)
		return 'y';
	if (lower.includes('deezer.com')) return 'd';
	if (lower.includes('tidal.com')) return 't';
	if (lower.includes('soundcloud.com')) return 'sc';
	return 's'; // default
}

export const actions = {
	lookup: async ({ request }) => {
		const formData = await request.formData();
		const url = formData.get('url');
		if (!url || typeof url !== 'string') {
			return fail(400, { error: 'Please enter a URL', url: '' });
		}

		let result;
		try {
			result = await lookupSong(url);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to look up song';
			return fail(502, { error: message, url });
		}

		const prefix = getPlatformPrefix(url);
		throw redirect(303, `/${prefix}/${result.id}`);
	}
} satisfies Actions;
