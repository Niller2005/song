import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const napster: PlatformProvider = {
	name: 'napster',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('napster.com')) return null;
		return parseOpenGraph(url, 'napster');
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist} Napster`;
		const url = await searchWeb(query, 'napster.com', /\/artist\/|\/album\//);
		if (url) {
			return {
				platform: 'napster',
				url
			};
		}
		return null;
	}
};
