import { lookupSong } from './lookup';

export async function findYouTubeUrl(spotifyUrl: string | null): Promise<string | null> {
	if (!spotifyUrl) return null;

	try {
		const result = await lookupSong(spotifyUrl);
		const youtube = result.platforms.find(
			(p) => p.platform === 'youtube' || p.platform === 'youtubeMusic'
		);
		return youtube?.url ?? null;
	} catch {
		return null;
	}
}
