import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const boomplay: PlatformProvider = {
	name: 'boomplay',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('boomplay.com')) return null;
		return parseOpenGraph(url, 'boomplay');
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist} Boomplay`;
		const url = await searchWeb(query, 'boomplay.com', /\/songs\/|\/albums\//);
		if (url) {
			return {
				platform: 'boomplay',
				url
			};
		}
		return null;
	}
};
