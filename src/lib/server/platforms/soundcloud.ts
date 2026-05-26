import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const soundcloud: PlatformProvider = {
	name: 'soundcloud',

	extractId(url: string): string | null {
		// extracting track slug and replacing / with -
		try {
			const u = new URL(url);
			const path = u.pathname.replace(/^\/+|\/+$/g, '');
			if (path) {
				return path.replace(/\//g, '-');
			}
		} catch {
			const match = url.match(/soundcloud\.com\/([^?#]+)/);
			if (match) {
				return match[1].replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
			}
		}
		return null;
	},

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('soundcloud.com')) return null;

		try {
			const res = await fetch(
				`https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`
			);
			if (!res.ok) return null;
			const data = await res.json();

			// Title is typically "Track Name by Artist Name"
			const titleParts = data.title?.split(' by ') ?? [];
			return {
				title: titleParts[0] ?? data.title ?? 'Unknown',
				artistName: titleParts.slice(1).join(' by ') || data.author_name || 'Unknown',
				thumbnailUrl: data.thumbnail_url ?? null,
				type: 'song',
				sourcePlatform: 'soundcloud'
			};
		} catch {
			return parseOpenGraph(url, 'soundcloud');
		}
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist} SoundCloud`;
		const url = await searchWeb(query, 'soundcloud.com');
		if (url) {
			return {
				platform: 'soundcloud',
				url
			};
		}
		return null;
	}
};
