import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const audiomack: PlatformProvider = {
	name: 'audiomack',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('audiomack.com')) return null;
		return parseOpenGraph(url, 'audiomack');
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist} Audiomack`;
		const url = await searchWeb(query, 'audiomack.com', /\/song\/|\/album\//);
		if (url) {
			return {
				platform: 'audiomack',
				url
			};
		}
		return null;
	}
};
