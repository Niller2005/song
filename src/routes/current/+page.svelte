<script lang="ts">
	import { authClient } from '$lib/auth-client';

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
		playedAt: string;
	}

	interface SongRequest {
		id: string;
		title: string;
		artist: string;
		albumArt: string | null;
		spotifyUrl: string | null;
		spotifyTrackId: string | null;
		status: 'pending' | 'queued' | 'playing' | 'played';
		requestedBy: string;
		requestedAt: string;
	}

	const session = authClient.useSession();

	let nowPlaying: NowPlayingData = $state({
		isPlaying: false,
		title: null,
		artist: null,
		album: null,
		albumArt: null,
		progress: null,
		duration: null,
		spotifyUrl: null,
		spotifyTrackId: null
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
		const [npRes, histRes, reqRes] = await Promise.all([
			fetch('/api/now-playing'),
			fetch('/api/history?limit=15'),
			fetch('/api/requests')
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

		if (reqRes.ok) {
			const all: SongRequest[] = await reqRes.json();
			queue = all.filter((r) => r.status === 'queued');
		}

		error = null;
	}

	$effect(() => {
		if ($session.data?.user) {
			fetchAll();
			const interval = setInterval(fetchAll, 10000);
			return () => clearInterval(interval);
		}
	});

	async function signInWithSpotify() {
		await authClient.signIn.social({
			provider: 'spotify',
			callbackURL: '/current'
		});
	}
</script>

<svelte:head>
	<title>Now Playing — Songlink</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
	<div class="mx-auto max-w-2xl">
		{#if $session.isPending}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="text-zinc-400">Loading...</p>
			</div>
		{:else if !$session.data?.user}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="mb-4 text-zinc-300">Connect your Spotify account to see what's playing.</p>
				<button
					onclick={signInWithSpotify}
					class="inline-block rounded-xl bg-[#1DB954] px-7 py-3.5 font-semibold text-white transition-colors hover:bg-[#1ed760]"
				>
					Sign in with Spotify
				</button>
			</div>
		{:else if nowPlaying.notConnected}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="mb-4 text-zinc-300">Connect your Spotify account to see what's playing.</p>
				<button
					onclick={signInWithSpotify}
					class="inline-block rounded-xl bg-[#1DB954] px-7 py-3.5 font-semibold text-white transition-colors hover:bg-[#1ed760]"
				>
					Connect Spotify
				</button>
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
						{#if nowPlaying.spotifyUrl}
							<a
								href={nowPlaying.spotifyUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="shrink-0 rounded-md bg-[#1DB954] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#1ed760]"
							>
								Open
							</a>
						{/if}
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
							<a
								href={entry.spotifyUrl ?? '#'}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-zinc-900 {!entry.spotifyUrl
									? 'pointer-events-none'
									: ''}"
							>
								{#if entry.albumArt}
									<img src={entry.albumArt} alt="" class="h-9 w-9 shrink-0 rounded object-cover" />
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm text-zinc-300">{entry.title}</p>
									<p class="truncate text-xs text-zinc-600">{entry.artist}</p>
								</div>
								<span class="shrink-0 text-xs text-zinc-700">{timeAgo(entry.playedAt)}</span>
							</a>
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
