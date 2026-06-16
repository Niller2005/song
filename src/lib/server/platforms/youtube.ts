import type { PlatformProvider, SongMetadata, PlatformResult } from './types';

const PIPED_INSTANCES = [
	'https://pipedapi.kavin.rocks',
	'https://pipedapi.adminforge.de',
	'https://pipedapi.in.projectsegfau.lt'
];

const INVIDIOUS_INSTANCES = ['https://inv.nadeko.net', 'https://invidious.nerdvpn.de'];

interface CandidateVideo {
	id: string;
	title: string;
	uploader?: string;
	thumbnailUrl?: string;
	platformType: 'youtube' | 'youtubeMusic';
}

export const BLACKLIST_TERMS = [
	'cover',
	'remix',
	'sped up',
	'slowed',
	'reverb',
	'nightcore',
	'instrumental',
	'karaoke'
];

export function getActiveBlacklist(title: string, artist: string): string[] {
	const lowerTitle = title.toLowerCase();
	const lowerArtist = artist.toLowerCase();
	return BLACKLIST_TERMS.filter(
		(term) => !lowerTitle.includes(term) && !lowerArtist.includes(term)
	);
}

export function selectBestVideo(
	candidates: CandidateVideo[],
	activeBlacklist: string[],
	artist: string,
	title: string
): CandidateVideo | null {
	if (candidates.length === 0) return null;

	const normalizedArtist = artist.trim().toLowerCase();
	const normalizedTitle = title.trim().toLowerCase();

	const scored = candidates.map((video) => {
		let score = 0;
		const lowerVideoTitle = video.title.toLowerCase();
		const lowerUploader = (video.uploader ?? '').toLowerCase();

		// 1. Blacklist penalty (fatal unless everything is blacklisted, but let's make it a massive penalty)
		const isBlacklisted = activeBlacklist.some((term) => lowerVideoTitle.includes(term));
		if (isBlacklisted) {
			score -= 1000;
		}

		// 2. Artist match in uploader/channel name
		if (normalizedArtist && lowerUploader) {
			if (lowerUploader === normalizedArtist || lowerUploader.includes(normalizedArtist)) {
				score += 100;
			}
		}

		// 3. Artist match in title
		if (normalizedArtist && lowerVideoTitle.includes(normalizedArtist)) {
			score += 50;
		}

		// 4. Exact/partial title match bonus
		if (normalizedTitle && lowerVideoTitle.includes(normalizedTitle)) {
			score += 30;
		}

		return { video, score };
	});

	// Sort by score descending
	scored.sort((a, b) => b.score - a.score);

	if (scored[0].score <= 0) return null;

	return scored[0].video;
}

export async function pipedFetch(path: string): Promise<Response | null> {
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

export function extractVideoId(url: string): string | null {
	const match = url.match(
		/(?:v=|youtu\.be\/|\/embed\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
	);
	return match?.[1] ?? null;
}

export function isYouTubeMusicUrl(url: string): boolean {
	return url.includes('music.youtube.com');
}

export async function scrapeDirectHtml(encodedQuery: string): Promise<CandidateVideo[]> {
	try {
		const res = await fetch(`https://www.youtube.com/results?search_query=${encodedQuery}`, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
			},
			signal: AbortSignal.timeout(6000)
		});

		if (!res.ok) return [];
		const html = await res.text();
		const segments = html.split('"videoRenderer":');
		const candidates: CandidateVideo[] = [];
		const maxResults = Math.min(segments.length, 16);

		for (let i = 1; i < maxResults; i++) {
			const segment = segments[i];
			const videoIdMatch = segment.match(/^\{\s*"videoId"\s*:\s*"([^"]+)"/);
			if (!videoIdMatch) continue;

			const videoId = videoIdMatch[1];

			const titleMatch = segment.match(
				/"title"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/
			);
			if (!titleMatch) continue;

			let videoTitle = '';
			try {
				videoTitle = JSON.parse(`"${titleMatch[1]}"`);
			} catch {
				videoTitle = titleMatch[1];
			}

			let uploader = '';
			const ownerMatch = segment.match(
				/"(?:ownerText|shortBylineText|longBylineText)"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/
			);
			if (ownerMatch) {
				try {
					uploader = JSON.parse(`"${ownerMatch[1]}"`);
				} catch {
					uploader = ownerMatch[1];
				}
			}

			candidates.push({
				id: videoId,
				title: videoTitle,
				uploader,
				thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
				platformType: 'youtube'
			});
		}

		// Also look for lockupViewModel segments (often used for official mixes/playlists on the search page)
		const lockupSegments = html.split('"lockupViewModel":');
		for (let i = 1; i < lockupSegments.length; i++) {
			const segment = lockupSegments[i];
			const watchMatch = segment.match(/"watchEndpoint"\s*:\s*\{\s*"videoId"\s*:\s*"([^"]+)"/);
			if (!watchMatch) continue;
			const videoId = watchMatch[1];

			const titleMatch = segment.match(/"title"\s*:\s*\{\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
			let videoTitle = '';
			if (titleMatch) {
				try {
					videoTitle = JSON.parse(`"${titleMatch[1]}"`);
				} catch {
					videoTitle = titleMatch[1];
				}
			}

			if (videoTitle) {
				// Clean up "Mix – " or "Mix - " prefix if present
				if (videoTitle.startsWith('Mix – ')) {
					videoTitle = videoTitle.replace(/^Mix – /, '');
				} else if (videoTitle.startsWith('Mix - ')) {
					videoTitle = videoTitle.replace(/^Mix - /, '');
				}

				let uploader = '';
				const subSimpleMatch = segment.match(
					/"subtitle"\s*:\s*\{\s*"simpleText"\s*:\s*"((?:[^"\\]|\\.)*)"/
				);
				const subRunsMatch = segment.match(
					/"subtitle"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"/
				);
				if (subSimpleMatch) {
					try {
						uploader = JSON.parse(`"${subSimpleMatch[1]}"`);
					} catch {
						uploader = subSimpleMatch[1];
					}
				} else if (subRunsMatch) {
					try {
						uploader = JSON.parse(`"${subRunsMatch[1]}"`);
					} catch {
						uploader = subRunsMatch[1];
					}
				}

				candidates.push({
					id: videoId,
					title: videoTitle,
					uploader,
					thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
					platformType: 'youtube'
				});
			}
		}

		return candidates;
	} catch (err) {
		console.error('YouTube direct HTML search failed:', err);
		return [];
	}
}

export const youtube: PlatformProvider = {
	name: 'youtube',

	extractId(url: string): string | null {
		if (isYouTubeMusicUrl(url)) return null;
		return extractVideoId(url);
	},

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (isYouTubeMusicUrl(url)) return null;
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
				sourcePlatform: 'youtube'
			};
		} catch {
			return null;
		}
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const activeBlacklist = getActiveBlacklist(title, artist);
		const query = `${title} ${artist}`;
		const encodedQuery = encodeURIComponent(query);

		// 1. Direct HTML Scraper
		const candidates = await scrapeDirectHtml(encodedQuery);
		const chosen = selectBestVideo(candidates, activeBlacklist, artist, title);
		if (chosen) {
			return {
				platform: 'youtube',
				url: `https://www.youtube.com/watch?v=${chosen.id}`,
				title: title,
				artistName: artist,
				thumbnailUrl: chosen.thumbnailUrl ?? `https://i.ytimg.com/vi/${chosen.id}/hqdefault.jpg`
			};
		}

		// 2. Piped (with filter=videos)
		try {
			const res = await pipedFetch(`/search?q=${encodedQuery}&filter=videos`);
			if (res) {
				const data = await res.json();
				const pipedCandidates: CandidateVideo[] = [];
				if (Array.isArray(data.items)) {
					const limit = Math.min(data.items.length, 10);
					for (let i = 0; i < limit; i++) {
						const item = data.items[i];
						if (!item || !item.url) continue;
						const id = extractVideoId(item.url);
						if (!id) continue;
						pipedCandidates.push({
							id,
							title: item.title ?? '',
							uploader: item.uploaderName,
							thumbnailUrl: item.thumbnail,
							platformType: 'youtube'
						});
					}
				}

				const pipedChosen = selectBestVideo(pipedCandidates, activeBlacklist, artist, title);
				if (pipedChosen) {
					return {
						platform: 'youtube',
						url: `https://www.youtube.com/watch?v=${pipedChosen.id}`,
						title: pipedChosen.title || title,
						artistName: pipedChosen.uploader || artist,
						thumbnailUrl: pipedChosen.thumbnailUrl
					};
				}
			}
		} catch (err) {
			console.error('YouTube Piped search failed:', err);
		}

		// 3. Invidious (with type=video)
		for (const instance of INVIDIOUS_INSTANCES) {
			try {
				const res = await fetch(`${instance}/api/v1/search?q=${encodedQuery}&type=video`, {
					signal: AbortSignal.timeout(5000)
				});
				if (!res.ok) continue;
				const results = await res.json();
				const invidiousCandidates: CandidateVideo[] = [];
				if (Array.isArray(results)) {
					const limit = Math.min(results.length, 10);
					for (let i = 0; i < limit; i++) {
						const item = results[i];
						if (!item || !item.videoId) continue;
						invidiousCandidates.push({
							id: item.videoId,
							title: item.title ?? '',
							uploader: item.author,
							thumbnailUrl: item.videoThumbnails?.[0]?.url,
							platformType: 'youtube'
						});
					}
				}

				const invidiousChosen = selectBestVideo(
					invidiousCandidates,
					activeBlacklist,
					artist,
					title
				);
				if (invidiousChosen) {
					return {
						platform: 'youtube',
						url: `https://www.youtube.com/watch?v=${invidiousChosen.id}`,
						title: invidiousChosen.title || title,
						artistName: invidiousChosen.uploader || artist,
						thumbnailUrl: invidiousChosen.thumbnailUrl
					};
				}
			} catch {
				continue;
			}
		}

		return null;
	}
};

export const youtubeMusic: PlatformProvider = {
	name: 'youtubeMusic',

	extractId(url: string): string | null {
		if (!isYouTubeMusicUrl(url)) return null;
		return extractVideoId(url);
	},

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!isYouTubeMusicUrl(url)) return null;
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
				sourcePlatform: 'youtubeMusic'
			};
		} catch {
			return null;
		}
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const activeBlacklist = getActiveBlacklist(title, artist);
		const query = `${title} ${artist}`;
		const encodedQuery = encodeURIComponent(query);

		// 1. Piped with filter=music_songs
		try {
			const res = await pipedFetch(`/search?q=${encodedQuery}&filter=music_songs`);
			if (res) {
				const data = await res.json();
				const candidates: CandidateVideo[] = [];
				if (Array.isArray(data.items)) {
					const limit = Math.min(data.items.length, 10);
					for (let i = 0; i < limit; i++) {
						const item = data.items[i];
						if (!item || !item.url) continue;
						const id = extractVideoId(item.url);
						if (!id) continue;
						candidates.push({
							id,
							title: item.title ?? '',
							uploader: item.uploaderName,
							thumbnailUrl: item.thumbnail,
							platformType: 'youtubeMusic'
						});
					}
				}

				const chosen = selectBestVideo(candidates, activeBlacklist, artist, title);
				if (chosen) {
					return {
						platform: 'youtubeMusic',
						url: `https://music.youtube.com/watch?v=${chosen.id}`,
						title: chosen.title || title,
						artistName: chosen.uploader || artist,
						thumbnailUrl: chosen.thumbnailUrl
					};
				}
			}
		} catch (err) {
			console.error('YouTube Music Piped search failed:', err);
		}

		// 2. Direct HTML search fallback
		const directCandidates = await scrapeDirectHtml(encodedQuery);
		const chosen = selectBestVideo(directCandidates, activeBlacklist, artist, title);
		if (chosen) {
			return {
				platform: 'youtubeMusic',
				url: `https://music.youtube.com/watch?v=${chosen.id}`,
				title: title,
				artistName: artist,
				thumbnailUrl: chosen.thumbnailUrl ?? `https://i.ytimg.com/vi/${chosen.id}/hqdefault.jpg`
			};
		}

		return null;
	}
};
