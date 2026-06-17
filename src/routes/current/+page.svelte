<script lang="ts">
	interface NowPlayingData {
		isPlaying: boolean;
		title: string | null;
		artist: string | null;
		album: string | null;
		albumArt: string | null;
		progress: number | null;
		duration: number | null;
		spotifyUrl: string | null;
		spotifyTrackId: string | null;
		youtubeUrl: string | null;
		notConnected?: boolean;
	}

	interface HistoryEntry {
		id: string;
		title: string;
		artist: string;
		album: string | null;
		albumArt: string | null;
		spotifyUrl: string | null;
		spotifyTrackId: string | null;
		youtubeUrl: string | null;
		playedAt: string;
	}

	interface SongRequest {
		id: string;
		title: string;
		artist: string;
		albumArt: string | null;
		spotifyUrl: string | null;
		spotifyTrackId: string | null;
		youtubeUrl: string | null;
		status: 'pending' | 'queued' | 'playing' | 'played';
		requestedBy: string;
		requestedAt: string;
	}

	let nowPlaying: NowPlayingData = $state({
		isPlaying: false,
		title: null,
		artist: null,
		album: null,
		albumArt: null,
		progress: null,
		duration: null,
		spotifyUrl: null,
		spotifyTrackId: null,
		youtubeUrl: null
	});

	let history: HistoryEntry[] = $state([]);
	let queue: SongRequest[] = $state([]);
	let error = $state<string | null>(null);

	function formatMs(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	function timeAgo(iso: string): string {
		const diff = Date.now() - new Date(iso).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.floor(hrs / 24)}d ago`;
	}

	let progressText = $derived(
		nowPlaying.progress != null && nowPlaying.duration != null
			? `${formatMs(nowPlaying.progress)} / ${formatMs(nowPlaying.duration)}`
			: ''
	);

	async function fetchAll() {
		const [npRes, histRes] = await Promise.all([
			fetch('/api/current'),
			fetch('/api/history?limit=15')
		]);

		if (npRes.ok) {
			const json = await npRes.json();
			nowPlaying = json;
		}

		if (histRes.ok) {
			const all: HistoryEntry[] = await histRes.json();
			history = all.filter(
				(e) => nowPlaying.spotifyTrackId == null || e.spotifyTrackId !== nowPlaying.spotifyTrackId
			);
		}

		error = null;
	}

	$effect(() => {
		fetchAll();
		const interval = setInterval(fetchAll, 10000);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>Now Playing — Songlink</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
	<div class="mx-auto max-w-2xl">
		{#if nowPlaying.notConnected}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="text-zinc-400">Spotify not connected.</p>
				<p class="mt-2 text-sm text-zinc-600">Connect a Spotify account to show currently playing tracks.</p>
			</div>
		{:else}

			<!-- Now Playing -->
			<section class="mb-8">
				{#if nowPlaying.isPlaying && nowPlaying.title}
					<div class="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3">
						{#if nowPlaying.albumArt}
							<img
								src={nowPlaying.albumArt}
								alt={nowPlaying.album ?? 'Album art'}
								class="h-10 w-10 shrink-0 rounded-lg object-cover"
							/>
						{:else}
							<div class="h-10 w-10 shrink-0 rounded-lg bg-zinc-800"></div>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-white">{nowPlaying.title}</p>
							<p class="truncate text-xs text-zinc-400">{nowPlaying.artist}</p>
						</div>
						{#if progressText}
							<span class="hidden shrink-0 text-xs tabular-nums text-zinc-600 sm:inline">{progressText}</span>
						{/if}
						<div class="flex shrink-0 items-center gap-1">
							{#if nowPlaying.spotifyUrl}
								<a href={nowPlaying.spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in Spotify" class="text-zinc-500 transition-colors hover:text-[#1ed760]">
									<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 256 256"><path fill="none" d="M0 0h256v256H0z"/><path fill="currentColor" d="M128 0C57.308 0 0 57.309 0 128c0 70.696 57.309 128 128 128 70.697 0 128-57.304 128-128C256 57.314 198.697.007 127.998.007zm58.699 184.614c-2.293 3.76-7.215 4.952-10.975 2.644-30.053-18.357-67.885-22.515-112.44-12.335a7.98 7.98 0 0 1-9.552-6.007 7.97 7.97 0 0 1 6-9.553c48.76-11.14 90.583-6.344 124.323 14.276 3.76 2.308 4.952 7.215 2.644 10.975m15.667-34.853c-2.89 4.695-9.034 6.178-13.726 3.289-34.406-21.148-86.853-27.273-127.548-14.92-5.278 1.594-10.852-1.38-12.454-6.649-1.59-5.278 1.386-10.842 6.655-12.446 46.485-14.106 104.275-7.273 143.787 17.007 4.692 2.89 6.175 9.034 3.286 13.72zm1.345-36.293C162.457 88.964 94.394 86.71 55.007 98.666c-6.325 1.918-13.014-1.653-14.93-7.978-1.917-6.328 1.65-13.012 7.98-14.935C93.27 62.027 168.434 64.68 215.929 92.876c5.702 3.376 7.566 10.724 4.188 16.405-3.362 5.69-10.73 7.565-16.4 4.187z"/></svg>
								</a>
							{/if}
							{#if nowPlaying.youtubeUrl}
								<a href={nowPlaying.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on YouTube" class="text-zinc-500 transition-colors hover:text-[#ff0000]">
									<svg xmlns="http://www.w3.org/2000/svg" width="22" height="15.47" viewBox="0 0 256 180"><path fill="none" d="M0 0h256v180H0z"/><path fill="currentColor" d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134"/><path fill="#fff" d="m102.421 128.06 66.328-38.418-66.328-38.418z"/></svg>
								</a>
							{/if}
						</div>
					</div>
				{:else}
					<div class="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-center">
						<p class="text-sm text-zinc-500">Nothing is playing right now.</p>
						<p class="text-xs text-zinc-700">Play something on Spotify and it'll show up here.</p>
					</div>
				{/if}
			</section>

			<!-- Queue -->
			<section class="mb-8">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">Queue</h2>
				{#if queue.length === 0}
					<p class="text-sm text-zinc-600">No queued tracks.</p>
				{:else}
					<div class="space-y-2">
						{#each queue as req (req.id)}
							<div class="flex items-center gap-3 rounded-lg border border-sky-800/30 bg-zinc-900/50 px-4 py-3">
								{#if req.albumArt}
									<img src={req.albumArt} alt="" class="h-10 w-10 shrink-0 rounded object-cover" />
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-white">{req.title}</p>
									<p class="truncate text-xs text-zinc-500">{req.artist}</p>
								</div>
								<div class="flex shrink-0 items-center gap-2">
									<span class="rounded-full bg-sky-950/50 px-2.5 py-0.5 text-xs font-medium text-sky-400">
										queued
									</span>
									<span class="text-xs text-zinc-600">{req.requestedBy}</span>
									<div class="flex items-center gap-1">
										{#if req.spotifyUrl}
											<a href={req.spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in Spotify" class="text-zinc-600 transition-colors hover:text-[#1ed760]">
												<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256"><path fill="none" d="M0 0h256v256H0z"/><path fill="currentColor" d="M128 0C57.308 0 0 57.309 0 128c0 70.696 57.309 128 128 128 70.697 0 128-57.304 128-128C256 57.314 198.697.007 127.998.007zm58.699 184.614c-2.293 3.76-7.215 4.952-10.975 2.644-30.053-18.357-67.885-22.515-112.44-12.335a7.98 7.98 0 0 1-9.552-6.007 7.97 7.97 0 0 1 6-9.553c48.76-11.14 90.583-6.344 124.323 14.276 3.76 2.308 4.952 7.215 2.644 10.975m15.667-34.853c-2.89 4.695-9.034 6.178-13.726 3.289-34.406-21.148-86.853-27.273-127.548-14.92-5.278 1.594-10.852-1.38-12.454-6.649-1.59-5.278 1.386-10.842 6.655-12.446 46.485-14.106 104.275-7.273 143.787 17.007 4.692 2.89 6.175 9.034 3.286 13.72zm1.345-36.293C162.457 88.964 94.394 86.71 55.007 98.666c-6.325 1.918-13.014-1.653-14.93-7.978-1.917-6.328 1.65-13.012 7.98-14.935C93.27 62.027 168.434 64.68 215.929 92.876c5.702 3.376 7.566 10.724 4.188 16.405-3.362 5.69-10.73 7.565-16.4 4.187z"/></svg>
											</a>
										{/if}
										{#if req.youtubeUrl}
											<a href={req.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on YouTube" class="text-zinc-600 transition-colors hover:text-[#ff0000]">
												<svg xmlns="http://www.w3.org/2000/svg" width="18" height="12.66" viewBox="0 0 256 180"><path fill="none" d="M0 0h256v180H0z"/><path fill="currentColor" d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134"/><path fill="#fff" d="m102.421 128.06 66.328-38.418-66.328-38.418z"/></svg>
											</a>
										{/if}
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- History -->
			<section class="mb-8">
				<h2 class="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">Recently Played</h2>
				{#if history.length === 0}
					<p class="text-sm text-zinc-600">No history yet.</p>
				{:else}
					<div class="space-y-1">
						{#each history.slice(0, 4) as entry (entry.id)}
							<div class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-zinc-900">
								{#if entry.albumArt}
									<img src={entry.albumArt} alt="" class="h-9 w-9 shrink-0 rounded object-cover" />
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm text-zinc-300">{entry.title}</p>
									<p class="truncate text-xs text-zinc-600">{entry.artist}</p>
								</div>
								<span class="shrink-0 text-xs text-zinc-700">{timeAgo(entry.playedAt)}</span>
								<div class="flex shrink-0 items-center gap-1">
									{#if entry.spotifyUrl}
										<a href={entry.spotifyUrl} target="_blank" rel="noopener noreferrer" aria-label="Open in Spotify" class="text-zinc-600 transition-colors hover:text-[#1ed760]">
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path fill="none" d="M0 0h256v256H0z"/><path fill="currentColor" d="M128 0C57.308 0 0 57.309 0 128c0 70.696 57.309 128 128 128 70.697 0 128-57.304 128-128C256 57.314 198.697.007 127.998.007zm58.699 184.614c-2.293 3.76-7.215 4.952-10.975 2.644-30.053-18.357-67.885-22.515-112.44-12.335a7.98 7.98 0 0 1-9.552-6.007 7.97 7.97 0 0 1 6-9.553c48.76-11.14 90.583-6.344 124.323 14.276 3.76 2.308 4.952 7.215 2.644 10.975m15.667-34.853c-2.89 4.695-9.034 6.178-13.726 3.289-34.406-21.148-86.853-27.273-127.548-14.92-5.278 1.594-10.852-1.38-12.454-6.649-1.59-5.278 1.386-10.842 6.655-12.446 46.485-14.106 104.275-7.273 143.787 17.007 4.692 2.89 6.175 9.034 3.286 13.72zm1.345-36.293C162.457 88.964 94.394 86.71 55.007 98.666c-6.325 1.918-13.014-1.653-14.93-7.978-1.917-6.328 1.65-13.012 7.98-14.935C93.27 62.027 168.434 64.68 215.929 92.876c5.702 3.376 7.566 10.724 4.188 16.405-3.362 5.69-10.73 7.565-16.4 4.187z"/></svg>
										</a>
									{/if}
									{#if entry.youtubeUrl}
										<a href={entry.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Open on YouTube" class="text-zinc-600 transition-colors hover:text-[#ff0000]">
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="11.25" viewBox="0 0 256 180"><path fill="none" d="M0 0h256v180H0z"/><path fill="currentColor" d="M250.346 28.075A32.18 32.18 0 0 0 227.69 5.418C207.824 0 127.87 0 127.87 0S47.912.164 28.046 5.582A32.18 32.18 0 0 0 5.39 28.24c-6.009 35.298-8.34 89.084.165 122.97a32.18 32.18 0 0 0 22.656 22.657c19.866 5.418 99.822 5.418 99.822 5.418s79.955 0 99.82-5.418a32.18 32.18 0 0 0 22.657-22.657c6.338-35.348 8.291-89.1-.164-123.134"/><path fill="#fff" d="m102.421 128.06 66.328-38.418-66.328-38.418z"/></svg>
										</a>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
				<a href="/history" class="mt-2 inline-block text-xs text-violet-400 hover:underline">Full history →</a>
			</section>

			{#if error}
				<div class="rounded-xl border border-red-800 bg-red-950/50 px-5 py-4 text-red-300">
					{error}
				</div>
			{/if}
		{/if}
	</div>
</div>
