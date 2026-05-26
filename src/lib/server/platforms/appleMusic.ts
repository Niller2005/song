import type { PlatformProvider, SongMetadata, PlatformResult } from './types';

function extractTrackId(url: string): string | null {
	// https://music.apple.com/us/album/name/123?i=456 -> 456
	const urlObj = new URL(url);
	const trackId = urlObj.searchParams.get('i');
	if (trackId) return trackId;

	// https://music.apple.com/us/song/name/123 -> 123
	const songMatch = url.match(/\/song\/[^/]+\/(\d+)/);
	if (songMatch) return songMatch[1];

	return null;
}

export const appleMusic: PlatformProvider = {
	name: 'appleMusic',

	async parseUrl(url: string): Promise<SongMetadata | null> {
		if (!url.includes('music.apple.com') && !url.includes('itunes.apple.com')) return null;

		const trackId = extractTrackId(url);
		if (!trackId) return null;

		try {
			const res = await fetch(`https://itunes.apple.com/lookup?id=${trackId}&entity=song`);
			if (!res.ok) return null;
			const data = await res.json();
			const track = data.results?.[0];
			if (!track) return null;

			return {
				title: track.trackName ?? 'Unknown',
				artistName: track.artistName ?? 'Unknown',
				thumbnailUrl: track.artworkUrl100?.replace('100x100', '600x600') ?? null,
				type: 'song',
				sourcePlatform: 'appleMusic'
			};
		} catch {
			return null;
		}
	},

	async search(title: string, artist: string): Promise<PlatformResult | null> {
		try {
			const term = encodeURIComponent(`${title} ${artist}`);
			const res = await fetch(
				`https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=5`
			);
			if (!res.ok) return null;
			const data = await res.json();

			// Find best match by comparing title + artist
			const track =
				data.results?.find(
					(r: any) =>
						r.trackName?.toLowerCase().includes(title.toLowerCase()) ||
						title.toLowerCase().includes(r.trackName?.toLowerCase())
				) ?? data.results?.[0];

			if (!track) return null;

			return {
				platform: 'appleMusic',
				url: track.trackViewUrl,
				title: track.trackName,
				artistName: track.artistName,
				thumbnailUrl: track.artworkUrl100?.replace('100x100', '600x600')
			};
		} catch {
			return null;
		}
	}
};
