import type { PlatformProvider, SongMetadata, PlatformResult } from './types';
import { env } from '$env/dynamic/private';

function extractTrackId(url: string): string | null {
	const match = url.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([a-zA-Z0-9]+)/);
	return match?.[1] ?? null;
}

export const spotify: PlatformProvider = {
	name: 'spotify',

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

		// Fallback: oEmbed (always free, no auth)
		// Note: Spotify oEmbed only returns the track name in `title`, not the artist.
		// The HTML iframe embed contains artist info but we can't reliably extract it.
		try {
			const res = await fetch(
				`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`
			);
			if (!res.ok) return null;
			const data = await res.json();

			// oEmbed gives us the track title. Use iTunes to find the artist.
			let artistName = 'Unknown';
			const title = data.title ?? 'Unknown';
			const thumbnailUrl = data.thumbnail_url ?? null;

			if (title !== 'Unknown') {
				try {
					const itunesRes = await fetch(
						`https://itunes.apple.com/search?term=${encodeURIComponent(title)}&media=music&entity=song&limit=5`
					);
					if (itunesRes.ok) {
						const itunesData = await itunesRes.json();
						// Find best match by title similarity
						const match =
							itunesData.results?.find(
								(r: any) => r.trackName?.toLowerCase() === title.toLowerCase()
							) ?? itunesData.results?.[0];
						if (match) {
							artistName = match.artistName ?? 'Unknown';
						}
					}
				} catch {
					// iTunes lookup failed, continue with Unknown artist
				}
			}

			return {
				title,
				artistName,
				thumbnailUrl,
				type: 'song',
				sourcePlatform: 'spotify'
			};
		} catch (err) {
			console.error('Spotify oEmbed failed:', err);
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
