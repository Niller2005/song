import type { SongMetadata } from './types';

/**
 * Searches DuckDuckGo HTML search for a direct matching link.
 * Extracts redirected URLs from `uddg=([^&"]+)` query parameters.
 * Decodes and checks if they match filterDomain and pathPattern.
 */
export async function searchWeb(
	query: string,
	filterDomain: string,
	pathPattern?: RegExp
): Promise<string | null> {
	try {
		const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
		const res = await fetch(searchUrl, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.5'
			},
			signal: AbortSignal.timeout(6000)
		});

		if (!res.ok) {
			return null;
		}

		const html = await res.text();

		// DuckDuckGo HTML returns search results containing <a class="result__url" href="..."> or links containing uddg=...
		// Let's use a regex to extract all uddg= links.
		// DDG links look like: //duckduckgo.com/l/?kh=-1&uddg=https%3A%2F%2Fmusic.apple.com%2F...
		const uddgRegex = /uddg=([^&"'>]+)/g;
		let match;
		const urls: string[] = [];

		while ((match = uddgRegex.exec(html)) !== null) {
			try {
				const decodedUrl = decodeURIComponent(match[1]);
				urls.push(decodedUrl);
			} catch {
				// Ignore decoding errors
			}
		}

		// Also look for absolute URLs directly that might match the filter domain in the HTML
		const hrefRegex = /href="([^"]+)"/g;
		while ((match = hrefRegex.exec(html)) !== null) {
			const link = match[1];
			if (link.includes(filterDomain)) {
				urls.push(link);
			}
		}

		for (const url of urls) {
			try {
				const u = new URL(url);
				if (u.hostname.includes(filterDomain)) {
					if (pathPattern && !pathPattern.test(u.pathname)) {
						continue;
					}
					return url;
				}
			} catch {
				// Invalid URL structure
			}
		}

		return null;
	} catch (err) {
		console.error(`searchWeb failed for query: "${query}" on domain "${filterDomain}":`, err);
		return null;
	}
}

/**
 * Generic OpenGraph metadata parser:
 * - Fetches the page with a browser-like User-Agent.
 * - Parses og:title, og:image, and artist details (music:musician, og:audio:artist, etc. or title tags).
 */
export async function parseOpenGraph(
	url: string,
	sourcePlatform: string
): Promise<SongMetadata | null> {
	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.5'
			},
			signal: AbortSignal.timeout(6000)
		});

		if (!res.ok) {
			return null;
		}

		const html = await res.text();

		// Helper to extract content by property attribute
		const getMetaProperty = (property: string): string | null => {
			const regex = new RegExp(
				`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`,
				'i'
			);
			const match = html.match(regex);
			if (match) return match[1];

			// Try other ordering (content first, then property)
			const reverseRegex = new RegExp(
				`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`,
				'i'
			);
			const reverseMatch = html.match(reverseRegex);
			return reverseMatch ? reverseMatch[1] : null;
		};

		const ogTitle = getMetaProperty('og:title') || getMetaProperty('twitter:title');
		const ogImage = getMetaProperty('og:image') || getMetaProperty('twitter:image');
		const ogType = getMetaProperty('og:type');

		// Artist details can be in various tags
		let artistName =
			getMetaProperty('music:musician') ||
			getMetaProperty('music:musician_description') ||
			getMetaProperty('og:audio:artist') ||
			getMetaProperty('music:creator') ||
			getMetaProperty('twitter:creator');

		if (!ogTitle) {
			return null;
		}

		// Fallback for artist name or clean title/artist if title includes separator
		let title = ogTitle;
		if (!artistName) {
			// Try parsing <title> or og:title. E.g. "Song Name - Single by Artist" or "Artist - Song Name"
			const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
			const titleText = titleTagMatch ? titleTagMatch[1] : ogTitle;

			const separators = [' - ', ' | ', ' — ', ' by '];
			for (const sep of separators) {
				if (titleText.includes(sep)) {
					const parts = titleText.split(sep);
					// Usually "Artist - Song" or "Song by Artist"
					if (sep === ' by ') {
						title = parts[0].trim();
						artistName = parts[1].trim();
					} else {
						// Guessing order based on common patterns.
						// Let's assume parts[0] is artist or title.
						artistName = parts[0].trim();
						title = parts[1].trim();
					}
					break;
				}
			}
		}

		// Clean up titles or artists that might have "on Pandora", "on Amazon Music", etc.
		if (artistName) {
			artistName = artistName
				.replace(
					/\s+on\s+(?:Pandora|Amazon Music|Yandex|Napster|Audiomack|Audius|Anghami|Boomplay)/i,
					''
				)
				.trim();
		}
		title = title
			.replace(
				/\s+on\s+(?:Pandora|Amazon Music|Yandex|Napster|Audiomack|Audius|Anghami|Boomplay)/i,
				''
			)
			.trim();

		return {
			title: title || 'Unknown Title',
			artistName: artistName || 'Unknown Artist',
			thumbnailUrl: ogImage || null,
			type: ogType?.includes('album') ? 'album' : 'song',
			sourcePlatform
		};
	} catch (err) {
		console.error(`parseOpenGraph failed for URL "${url}":`, err);
		return null;
	}
}
