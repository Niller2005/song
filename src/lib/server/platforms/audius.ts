import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const audius: PlatformProvider = {
	name: 'audius',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('audius.co')) return null;
		return parseOpenGraph(url, 'audius');
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist}`;
		try {
			const res = await fetch(
				`https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(query)}`
			);
			if (res.ok) {
				const data = await res.json();
				const track = data.data?.[0];
				// Audius tracks usually have a permalink property or we construct it.
				// Let's see if we can find a track and construct its audius.co URL.
				if (track && track.permalink) {
					return {
						platform: 'audius',
						url: `https://audius.co${track.permalink}`,
						title: track.title,
						artistName: track.user?.name,
						thumbnailUrl: track.artwork?.['150x150']
					};
				}
			}
		} catch (err) {
			console.error('Audius API search failed, falling back to web search:', err);
		}

		// Fallback to web search
		const url = await searchWeb(`${query} Audius`, 'audius.co');
		if (url) {
			return {
				platform: 'audius',
				url
			};
		}

		return null;
	}
};
