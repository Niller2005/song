import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { env } from '$env/dynamic/private';
import { searchWeb, parseOpenGraph } from './searchHelper';

function extractTrackId(url: string): string | null {
	const match = url.match(/\/track\/(\d+)/);
	return match?.[1] ?? null;
}

async function getTidalToken(): Promise<string | null> {
	if (!env.TIDAL_CLIENT_ID || !env.TIDAL_CLIENT_SECRET) return null;
	try {
		const res = await fetch('https://auth.tidal.com/v1/oauth2/token', {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'client_credentials',
				client_id: env.TIDAL_CLIENT_ID,
				client_secret: env.TIDAL_CLIENT_SECRET
			})
		});
		if (!res.ok) return null;
		const data = await res.json();
		return data.access_token;
	} catch {
		return null;
	}
}

export const tidal: PlatformProvider = {
	name: 'tidal',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('tidal.com')) return null;

		const token = await getTidalToken();
		if (!token) {
			// Fallback to parseOpenGraph
			return parseOpenGraph(url, 'tidal');
		}

		const trackId = extractTrackId(url);
		if (!trackId) {
			return parseOpenGraph(url, 'tidal');
		}

		try {
			const res = await fetch(`https://openapi.tidal.com/v2/tracks/${trackId}?countryCode=US`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!res.ok) {
				return parseOpenGraph(url, 'tidal');
			}
			const data = await res.json();
			const track = data.data ?? data;
			const attrs = track.attributes ?? track;

			return {
				title: attrs.title ?? 'Unknown',
				artistName: attrs.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown',
				thumbnailUrl: attrs.imageLinks?.[0]?.href ?? null,
				type: 'song',
				sourcePlatform: 'tidal'
			};
		} catch {
			return parseOpenGraph(url, 'tidal');
		}
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		const query = `${title} ${artist}`;
		const token = await getTidalToken();

		if (token) {
			try {
				const encodedQuery = encodeURIComponent(query);
				const res = await fetch(
					`https://openapi.tidal.com/v2/search?query=${encodedQuery}&type=TRACKS&limit=3&countryCode=US`,
					{
						headers: { Authorization: `Bearer ${token}` }
					}
				);
				if (res.ok) {
					const data = await res.json();
					const track = data.data?.[0] ?? data.tracks?.[0];
					if (track) {
						const attrs = track.attributes ?? track;
						const trackId = track.id ?? attrs.id;

						return {
							platform: 'tidal',
							url: `https://listen.tidal.com/track/${trackId}`,
							title: attrs.title,
							artistName: attrs.artists?.map((a: any) => a.name).join(', ')
						};
					}
				}
			} catch (err) {
				console.error('Tidal official API search failed, falling back to web search:', err);
			}
		}

		// Fallback to web search
		const url = await searchWeb(`${query} Tidal`, 'tidal.com', /\/track\//);
		if (url) {
			return {
				platform: 'tidal',
				url
			};
		}

		return null;
	}
};
