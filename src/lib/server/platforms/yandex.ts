import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

export const yandex: PlatformProvider = {
	name: 'yandex',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('music.yandex.ru') && !url.includes('music.yandex.com')) return null;
		return parseOpenGraph(url, 'yandex');
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist} Yandex Music`;
		const url = await searchWeb(query, 'music.yandex.', /\/album\//);
		if (url) {
			return {
				platform: 'yandex',
				url
			};
		}
		return null;
	}
};
