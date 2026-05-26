import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const amazonMusic: PlatformProvider = {
	name: 'amazonMusic',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('music.amazon.com') && !url.includes('amazon.com/music')) return null;
		return parseOpenGraph(url, 'amazonMusic');
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist} Amazon Music`;
		const url = await searchWeb(query, 'music.amazon.com', /\/albums\/|tracks/);
		if (url) {
			return {
				platform: 'amazonMusic',
				url
			};
		}
		return null;
	}
};
