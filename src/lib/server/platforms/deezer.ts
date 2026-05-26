import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const deezer: PlatformProvider = {
	name: 'deezer',

	extractId(url: string): string | null {
		// \/track\/(\d+)
		const match = url.match(/\/track\/(\d+)/);
		return match ? match[1] : null;
	},

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('deezer.com')) return null;

		// Extract track/album ID
		const match = url.match(/\/(track|album)\/(\d+)/);
		if (!match) {
			// Fallback to parseOpenGraph
			return parseOpenGraph(url, 'deezer');
		}

		const [, type, id] = match;
		try {
			const res = await fetch(`https://api.deezer.com/${type}/${id}`);
			if (!res.ok) {
				return parseOpenGraph(url, 'deezer');
			}
			const data = await res.json();
			if (data.error) {
				return parseOpenGraph(url, 'deezer');
			}

			return {
				title: data.title ?? data.name ?? 'Unknown',
				artistName: data.artist?.name ?? 'Unknown',
				thumbnailUrl: data.album?.cover_medium ?? data.cover_medium ?? null,
				type: type === 'album' ? 'album' : 'song',
				sourcePlatform: 'deezer'
			};
		} catch {
			return parseOpenGraph(url, 'deezer');
		}
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist}`;
		try {
			const res = await fetch(
				`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`
			);
			if (res.ok) {
				const data = await res.json();
				const track = data.data?.[0];
				if (track && track.link) {
					return {
						platform: 'deezer',
						url: track.link,
						title: track.title,
						artistName: track.artist?.name,
						thumbnailUrl: track.album?.cover_medium
					};
				}
			}
		} catch (err) {
			console.error('Deezer API search failed, falling back to web search:', err);
		}

		// Fallback to searchWeb
		const url = await searchWeb(query, 'deezer.com', /\/(track|album)\/\d+/);
		if (url) {
			return {
				platform: 'deezer',
				url
			};
		}

		return null;
	}
};
