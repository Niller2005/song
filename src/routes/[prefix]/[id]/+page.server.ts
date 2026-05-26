import { db } from '$lib/server/db';
import { songs, platformLinks } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error, redirect, fail } from '@sveltejs/kit';
import { lookupSong } from '$lib/server/lookup';
import type { PageServerLoad, Actions } from './$types';

const VALID_PREFIXES = ['s', 'a', 'y', 'd', 't', 'sc'] as const;

const isUuid = (str: string) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ||
	str.startsWith('uuid-');

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

export const load: PageServerLoad = async ({ params }) => {
	const { prefix, id } = params;

	if (!VALID_PREFIXES.includes(prefix as any)) {
		throw error(404, 'Not found');
	}

	const dbSongId = isUuid(id) ? id : `${prefix}-${id}`;

	const song = await db.query.songs.findFirst({
		where: eq(songs.id, dbSongId)
	});

	if (!song) {
		throw error(404, 'Song not found');
	}

	const links = await db.select().from(platformLinks).where(eq(platformLinks.songId, song.id));

	return {
		song: {
			id: song.id,
			title: song.title,
			artistName: song.artistName,
			thumbnailUrl: song.thumbnailUrl,
			type: song.type,
			pageUrl: song.pageUrl || `/${prefix}/${id}`,
			platforms: links.map((l) => ({
				platform: l.platform,
				url: l.url,
				nativeAppUriMobile: l.nativeAppUriMobile,
				nativeAppUriDesktop: l.nativeAppUriDesktop
			}))
		}
	};
};

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
