export interface PlatformResult {
	platform: string;
	url: string;
	title?: string;
	artistName?: string;
	thumbnailUrl?: string;
}

export interface SongMetadata {
	title: string;
	artistName: string;
	thumbnailUrl: string | null;
	type: 'song' | 'album';
	sourcePlatform: string;
}

export interface PlatformProvider {
	name: string;
	/** Parse a URL - return metadata if this provider handles it, null otherwise */
	parseUrl(url: string): Promise<SongMetadata | null>;
	/** Search for a song by title + artist, return the best match URL */
	search(title: string, artist: string): Promise<PlatformResult | null>;
}
