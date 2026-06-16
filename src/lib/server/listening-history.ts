import { db } from '$lib/server/db';
import { listeningHistory } from '$lib/server/db/schema';
import { eq, desc } from 'drizzle-orm';
import { and, gt } from 'drizzle-orm';

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

interface TrackInfo {
	title: string;
	artist: string;
	album: string | null;
	albumArt: string | null;
	spotifyUrl: string | null;
	spotifyTrackId: string | null;
}

export async function recordPlay(userId: string, track: TrackInfo): Promise<void> {
	if (!track.spotifyTrackId) return;

	const cutoff = new Date(Date.now() - DEDUP_WINDOW_MS);

	const recent = await db.query.listeningHistory.findFirst({
		where: and(
			eq(listeningHistory.userId, userId),
			eq(listeningHistory.spotifyTrackId, track.spotifyTrackId),
			gt(listeningHistory.playedAt, cutoff)
		)
	});

	if (recent) return;

	await db.insert(listeningHistory).values({
		userId,
		title: track.title,
		artist: track.artist,
		album: track.album,
		albumArt: track.albumArt,
		spotifyUrl: track.spotifyUrl,
		spotifyTrackId: track.spotifyTrackId,
		playedAt: new Date()
	});
}

export async function getHistory(
	userId: string,
	limit = 50
): Promise<
	{
		id: string;
		title: string;
		artist: string;
		album: string | null;
		albumArt: string | null;
		spotifyUrl: string | null;
		spotifyTrackId: string | null;
		playedAt: Date;
	}[]
> {
	return db.query.listeningHistory.findMany({
		where: eq(listeningHistory.userId, userId),
		orderBy: desc(listeningHistory.playedAt),
		limit,
		columns: {
			id: true,
			title: true,
			artist: true,
			album: true,
			albumArt: true,
			spotifyUrl: true,
			spotifyTrackId: true,
			playedAt: true
		}
	});
}