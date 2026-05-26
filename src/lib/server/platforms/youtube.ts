import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { searchWeb, parseOpenGraph } from './searchHelper';

const PIPED_INSTANCES = [
	'https://pipedapi.kavin.rocks',
	'https://pipedapi.adminforge.de',
	'https://pipedapi.in.projectsegfau.lt'
];

const INVIDIOUS_INSTANCES = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de'];

async function pipedFetch(path: string): Promise<Response | null> {
	for (const instance of PIPED_INSTANCES) {
		try {
			const res = await fetch(`${instance}${path}`, { signal: AbortSignal.timeout(5000) });
			if (res.ok) return res;
		} catch {
			continue;
		}
	}
	return null;
}

function extractVideoId(url: string): string | null {
	const match = url.match(
		/(?:v=|youtu\.be\/|\/embed\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
	);
	return match?.[1] ?? null;
}

function isYouTubeMusicUrl(url: string): boolean {
	return url.includes('music.youtube.com');
}

export const youtube: PlatformProvider = {
	name: 'youtube',

	extractId(url: string): string | null {
		// [?&]v=([^&]+) or youtu.be\/([^?#/]+) or \/embed\/([^?#/]+)
		const match =
			url.match(/[?&]v=([^&]+)/) ||
			url.match(/youtu\.be\/([^?#/]+)/) ||
			url.match(/\/embed\/([^?#/]+)/);
		return match ? match[1] : null;
	},

	async parseUrl(url: string): Promise<SongMetadata | null> {
		const videoId = extractVideoId(url);
		if (!videoId) return null;

		try {
			// Use oEmbed for basic metadata
			const res = await fetch(
				`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
			);
			if (!res.ok) return null;
			const data = await res.json();

			return {
				title: data.title ?? 'Unknown',
				artistName: data.author_name ?? 'Unknown',
				thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
				type: 'song',
				sourcePlatform: isYouTubeMusicUrl(url) ? 'youtubeMusic' : 'youtube'
			};
		} catch {
			return null;
		}
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist}`;
		const encodedQuery = encodeURIComponent(query);

		try {
			// Fetch search results directly from YouTube
			const res = await fetch(`https://www.youtube.com/results?search_query=${encodedQuery}`, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
				},
				signal: AbortSignal.timeout(6000)
			});

			if (res.ok) {
				const html = await res.text();
				const match = html.match(/"videoId":\s*"([^"]+)"/);
				if (match?.[1]) {
					const videoId = match[1];
					return {
						platform: 'youtube',
						url: `https://www.youtube.com/watch?v=${videoId}`,
						title: title,
						artistName: artist,
						thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
					};
				}
			}
		} catch (err) {
			console.error('YouTube direct HTML search failed, falling back to piped:', err);
		}

		try {
			// Try music_songs filter first, then fall back to videos
			const res = await pipedFetch(`/search?q=${encodedQuery}&filter=music_songs`);
			if (res) {
				const data = await res.json();
				const item = data.items?.[0];
				if (item?.url) {
					return {
						platform: 'youtubeMusic',
						url: `https://music.youtube.com${item.url}`,
						title: item.title,
						artistName: item.uploaderName,
						thumbnailUrl: item.thumbnail
					};
				}
			}

			// Fallback without filter
			const res2 = await pipedFetch(`/search?q=${encodedQuery}&filter=videos`);
			if (res2) {
				const data2 = await res2.json();
				const item = data2.items?.[0];
				if (item?.url) {
					return {
						platform: 'youtube',
						url: `https://www.youtube.com${item.url}`,
						title: item.title,
						artistName: item.uploaderName,
						thumbnailUrl: item.thumbnail
					};
				}
			}
		} catch (err) {
			console.error('YouTube Piped search failed:', err);
		}

		// Try Invidious as last resort
		for (const instance of INVIDIOUS_INSTANCES) {
			try {
				const res = await fetch(`${instance}/api/v1/search?q=${encodedQuery}&type=video`, {
					signal: AbortSignal.timeout(5000)
				});
				if (!res.ok) continue;
				const results = await res.json();
				const item = results?.[0];
				if (item?.videoId) {
					return {
						platform: 'youtubeMusic',
						url: `https://music.youtube.com/watch?v=${item.videoId}`,
						title: item.title,
						artistName: item.author,
						thumbnailUrl: item.videoThumbnails?.[0]?.url
					};
				}
			} catch {
				continue;
			}
		}

		return null;
	}
};
