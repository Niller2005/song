import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { env } from '$env/dynamic/private';

function extractTrackId(url: string): string | null {
	const match = url.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)/);
	return match?.[1] ?? null;
}

export const spotify: PlatformProvider = {
	name: 'spotify',

	extractId(url: string): string | null {
		const match = url.match(
			/(?:open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(?:track|album)\/([a-zA-Z0-9]+))|(?:\/(?:track|album)\/([a-zA-Z0-9]+))/
		);
		return match ? (match[1] ?? match[2] ?? null) : null;
	},

	async parseUrl(url: string): Promise<SongMetadata | null> {
		const trackId = extractTrackId(url);
		if (!trackId) return null;

		// Try Spotify Web API first if credentials available
		if (env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET) {
			try {
				const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-www-form-urlencoded',
						Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`
					},
					body: 'grant_type=client_credentials'
				});
				const { access_token } = await tokenRes.json();
				const trackRes = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
					headers: { Authorization: `Bearer ${access_token}` }
				});
				if (trackRes.ok) {
					const track = await trackRes.json();
					return {
						title: track.name,
						artistName: track.artists.map((a: any) => a.name).join(', '),
						thumbnailUrl: track.album?.images?.[0]?.url ?? null,
						type: 'song',
						sourcePlatform: 'spotify'
					};
				}
			} catch {
				/* fall through to oEmbed */
			}
		}

		// Fallback: scrape the public Spotify embed page for title + artist.
		// oEmbed only returns the track title, and iTunes search for a common title
		// often returns the most popular wrong artist (e.g. Ed Sheeran instead of Jerri).
		try {
			const embedRes = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
				headers: {
					'User-Agent':
						'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
				}
			});
			if (embedRes.ok) {
				const html = await embedRes.text();
				const dataMatch = html.match(
					/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
				);
				if (dataMatch) {
					const data = JSON.parse(dataMatch[1]);
					const entity = data.props?.pageProps?.state?.data?.entity;
					if (entity && entity.type === 'track') {
						const title = entity.name ?? 'Unknown';
						const artistName = entity.artists?.map((a: any) => a.name).join(', ') ?? 'Unknown';
						const thumbnailUrl =
							entity.visualIdentity?.image?.find((i: any) => i.maxWidth === 640)?.url ??
							entity.visualIdentity?.image?.[0]?.url ??
							null;

						return {
							title,
							artistName,
							thumbnailUrl,
							type: 'song',
							sourcePlatform: 'spotify'
						};
					}
				}
			}
		} catch {
			/* fall through to oEmbed */
		}

		try {
			const res = await fetch(
				`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`
			);
			if (!res.ok) return null;
			const data = await res.json();

			return {
				title: data.title ?? 'Unknown',
				artistName: 'Unknown',
				thumbnailUrl: data.thumbnail_url ?? null,
				type: 'song',
				sourcePlatform: 'spotify'
			};
		} catch (err) {
			console.error('Spotify fallback failed:', err);
			return null;
		}
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return null;

		try {
			const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`
				},
				body: 'grant_type=client_credentials'
			});
			const { access_token } = await tokenRes.json();

			const q = encodeURIComponent(`track:${title} artist:${artist}`);
			const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, {
				headers: { Authorization: `Bearer ${access_token}` }
			});
			if (!searchRes.ok) return null;
			const data = await searchRes.json();
			const track = data.tracks?.items?.[0];
			if (!track) return null;

			return {
				platform: 'spotify',
				url: track.external_urls.spotify,
				title: track.name,
				artistName: track.artists.map((a: any) => a.name).join(', '),
				thumbnailUrl: track.album?.images?.[0]?.url
			};
		} catch {
			return null;
		}
	}
};
