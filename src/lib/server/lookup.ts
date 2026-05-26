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

export function getPlatformPrefix(url: string): string {
	const lower = url.toLowerCase();
	if (lower.includes('spotify.com') || lower.includes('open.spotify')) return 's';
	if (
		lower.includes('apple.com') ||
		lower.includes('music.apple') ||
		lower.includes('itunes.apple')
	)
		return 'a';
	if (
		lower.includes('youtube.com') ||
		lower.includes('youtu.be') ||
		lower.includes('music.youtube')
	)
		return 'y';
	if (lower.includes('deezer.com')) return 'd';
	if (lower.includes('tidal.com')) return 't';
	if (lower.includes('soundcloud.com')) return 'sc';
	return 's'; // default
}

export function extractNativeId(url: string): { prefix: string; id: string } | null {
	const prefix = getPlatformPrefix(url);
	const lowerUrl = url.toLowerCase();

	// Find the active provider that matches the domain and has extractId
	const provider = providers.find((p) => {
		if (!p.extractId) return false;
		if (p.name === 'spotify' && lowerUrl.includes('spotify.com')) return true;
		if (
			p.name === 'appleMusic' &&
			(lowerUrl.includes('apple.com') || lowerUrl.includes('itunes.apple.com'))
		)
			return true;
		if (p.name === 'youtube' && (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')))
			return true;
		if (p.name === 'deezer' && lowerUrl.includes('deezer.com')) return true;
		if (p.name === 'tidal' && lowerUrl.includes('tidal.com')) return true;
		if (p.name === 'soundcloud' && lowerUrl.includes('soundcloud.com')) return true;
		return false;
	});

	if (provider && provider.extractId) {
		const rawId = provider.extractId(url);
		if (rawId) {
			// Clean/sanitize to be completely URL-safe: match /[^a-zA-Z0-9\-_]/g to sanitize it
			const cleanId = rawId.replace(/[^a-zA-Z0-9\-_]/g, '');
			if (cleanId) {
				return { prefix, id: cleanId };
			}
		}
	}

	return null;
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

const isUuid = (str: string) =>
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str) ||
	str.startsWith('uuid-');

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

			// Extract short/clean URL ID from the composite ID if it is of form prefix-id
			// Let's parse out the prefix from the song.id or just use the prefix from cached/lookup
			const hasPrefixMatch = song.id.match(/^([a-z]+)-(.+)$/);
			const shortId = hasPrefixMatch && !isUuid(song.id) ? hasPrefixMatch[2] : song.id;
			const songPrefix = hasPrefixMatch && !isUuid(song.id) ? hasPrefixMatch[1] : 's';

			return {
				id: shortId,
				title: song.title,
				artistName: song.artistName,
				thumbnailUrl: song.thumbnailUrl,
				type: song.type,
				pageUrl: song.pageUrl || `/${songPrefix}/${shortId}`,
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

	const extracted = extractNativeId(normalized);
	const songId = extracted ? `${extracted.prefix}-${extracted.id}` : crypto.randomUUID();
	const prefix = extracted ? extracted.prefix : 's';
	const pageId = extracted ? extracted.id : songId;

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
		id: pageId,
		title: metadata.title,
		artistName: metadata.artistName,
		thumbnailUrl: metadata.thumbnailUrl,
		type: metadata.type,
		pageUrl: `/${prefix}/${pageId}`,
		platforms: platformEntries.map((e) => ({
			platform: e.platform,
			url: e.url,
			nativeAppUriMobile: e.nativeAppUriMobile,
			nativeAppUriDesktop: e.nativeAppUriDesktop
		})),
		cached: false
	};
}
