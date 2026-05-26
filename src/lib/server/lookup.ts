import { db } from './db';
import { songs, platformLinks, urlLookups } from './db/schema';
import { eq } from 'drizzle-orm';
import { providers } from './platforms';
import type { SongMetadata } from './platforms';

export interface SongResult {
	id: string;
	title: string;
	artistName: string;
	thumbnailUrl: string | null;
	type: 'song' | 'album';
	pageUrl: string | null;
	platforms: Array<{
		platform: string;
		url: string;
		nativeAppUriMobile: string | null;
		nativeAppUriDesktop: string | null;
	}>;
	cached: boolean;
}

function normalizeUrl(url: string): string {
	try {
		const u = new URL(url.trim());
		u.searchParams.delete('si');
		u.searchParams.delete('utm_source');
		u.searchParams.delete('utm_medium');
		u.searchParams.delete('utm_campaign');
		u.searchParams.delete('nd');
		return u.toString();
	} catch {
		return url.trim();
	}
}

export async function lookupSong(inputUrl: string): Promise<SongResult> {
	const normalized = normalizeUrl(inputUrl);

	// 1. Check cache
	const cached = await db.query.urlLookups.findFirst({
		where: eq(urlLookups.url, normalized)
	});

	if (cached) {
		const song = await db.query.songs.findFirst({
			where: eq(songs.id, cached.songId)
		});
		if (song) {
			const links = await db.select().from(platformLinks).where(eq(platformLinks.songId, song.id));
			return {
				id: song.id,
				title: song.title,
				artistName: song.artistName,
				thumbnailUrl: song.thumbnailUrl,
				type: song.type,
				pageUrl: song.pageUrl,
				platforms: links.map((l) => ({
					platform: l.platform,
					url: l.url,
					nativeAppUriMobile: l.nativeAppUriMobile,
					nativeAppUriDesktop: l.nativeAppUriDesktop
				})),
				cached: true
			};
		}
	}

	// 2. Parse the input URL to get metadata from the source platform (Sequential local providers lookup)
	let metadata: SongMetadata | null = null;
	let sourcePlatformUrl: { platform: string; url: string } | null = null;

	for (const provider of providers) {
		metadata = await provider.parseUrl(normalized);
		if (metadata) {
			sourcePlatformUrl = { platform: provider.name, url: normalized };
			break;
		}
	}

	if (!metadata) {
		const supportedList = providers
			.map((p) => p.name.charAt(0).toUpperCase() + p.name.slice(1))
			.join(', ');
		throw new Error(`Could not recognize this URL. Supported platforms: ${supportedList}`);
	}

	// 3. Search other platforms in parallel
	const searchResults = await Promise.allSettled(
		providers
			.filter((p) => p.name !== metadata!.sourcePlatform)
			.map(async (p) => {
				const result = await p.search(metadata!.title, metadata!.artistName);
				return result;
			})
	);

	// Collect all platform links
	const platformEntries: Array<{
		id: string;
		songId: string;
		platform: string;
		url: string;
		nativeAppUriMobile: string | null;
		nativeAppUriDesktop: string | null;
		entityId: string | null;
	}> = [];

	const songId = crypto.randomUUID();

	// Add source platform
	if (sourcePlatformUrl) {
		let platform = sourcePlatformUrl.platform;
		if (metadata.sourcePlatform === 'youtubeMusic' || metadata.sourcePlatform === 'youtube') {
			platform = metadata.sourcePlatform;
		}
		platformEntries.push({
			id: crypto.randomUUID(),
			songId,
			platform,
			url: sourcePlatformUrl.url,
			nativeAppUriMobile: null,
			nativeAppUriDesktop: null,
			entityId: null
		});
	}

	// Add search results
	for (const result of searchResults) {
		if (result.status === 'rejected') {
			console.error('Platform search failed:', result.reason);
		}
		if (result.status === 'fulfilled' && result.value) {
			const r = result.value;
			platformEntries.push({
				id: crypto.randomUUID(),
				songId,
				platform: r.platform,
				url: r.url,
				nativeAppUriMobile: null,
				nativeAppUriDesktop: null,
				entityId: null
			});
		}
	}

	// 4. Save to DB
	await db.insert(songs).values({
		id: songId,
		title: metadata.title,
		artistName: metadata.artistName,
		thumbnailUrl: metadata.thumbnailUrl,
		type: metadata.type,
		pageUrl: null
	});

	if (platformEntries.length > 0) {
		await db.insert(platformLinks).values(platformEntries);
	}

	// Cache input URL
	await db.insert(urlLookups).values({ url: normalized, songId }).onConflictDoNothing();

	// Cache all found platform URLs
	for (const entry of platformEntries) {
		const normUrl = normalizeUrl(entry.url);
		if (normUrl !== normalized) {
			await db.insert(urlLookups).values({ url: normUrl, songId }).onConflictDoNothing();
		}
	}

	return {
		id: songId,
		title: metadata.title,
		artistName: metadata.artistName,
		thumbnailUrl: metadata.thumbnailUrl,
		type: metadata.type,
		pageUrl: null,
		platforms: platformEntries.map((e) => ({
			platform: e.platform,
			url: e.url,
			nativeAppUriMobile: e.nativeAppUriMobile,
			nativeAppUriDesktop: e.nativeAppUriDesktop
		})),
		cached: false
	};
}
