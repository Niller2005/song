import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const pandora: PlatformProvider = {
	name: 'pandora',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('pandora.com')) return null;
		return parseOpenGraph(url, 'pandora');
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist} Pandora`;
		const url = await searchWeb(query, 'pandora.com', /\/artist\/|\/album\/|TR:/);
		if (url) {
			return {
				platform: 'pandora',
				url
			};
		}
		return null;
	}
};
