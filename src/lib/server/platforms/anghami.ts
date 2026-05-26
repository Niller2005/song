import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const anghami: PlatformProvider = {
	name: 'anghami',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('anghami.com')) return null;
		return parseOpenGraph(url, 'anghami');
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist} Anghami`;
		const url = await searchWeb(query, 'anghami.com', /\/song\/|\/album\//);
		if (url) {
			return {
				platform: 'anghami',
				url
			};
		}
		return null;
	}
};
