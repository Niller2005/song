<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const session = authClient.useSession();

	interface NowPlayingData {
		isPlaying: boolean;
		title: string | null;
		artist: string | null;
		album: string | null;
		albumArt: string | null;
		progress: number | null;
		duration: number | null;
		spotifyUrl: string | null;
		notConnected?: boolean;
	}

	interface SongRequest {
		id: string;
		title: string;
		artist: string;
		albumArt: string | null;
		spotifyUrl: string | null;
		spotifyTrackId: string | null;
		status: 'pending' | 'playing' | 'played';
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
		spotifyUrl: null
	});

	let requests: SongRequest[] = $state([]);
	let npError = $state<string | null>(null);
	let reqError = $state<string | null>(null);
	let copiedOverlay = $state(false);
	let copiedRequest = $state(false);

	function formatMs(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	let progressText = $derived(
		nowPlaying.progress != null && nowPlaying.duration != null
			? `${formatMs(nowPlaying.progress)} / ${formatMs(nowPlaying.duration)}`
			: ''
	);

	async function fetchNowPlaying() {
		try {
			const res = await fetch('/api/now-playing');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const json = await res.json();
			if (!json.notConnected) {
				nowPlaying = json;
			}
			npError = null;
		} catch (e) {
			npError = e instanceof Error ? e.message : 'Failed to fetch';
		}
	}

	async function fetchRequests() {
		try {
			const res = await fetch('/api/requests');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const json: SongRequest[] = await res.json();
			requests = json;
			reqError = null;
		} catch (e) {
			reqError = e instanceof Error ? e.message : 'Failed to fetch';
		}
	}

	$effect(() => {
		if ($session.data?.user) {
			fetchNowPlaying();
			fetchRequests();
			const npInterval = setInterval(fetchNowPlaying, 10000);
			const reqInterval = setInterval(fetchRequests, 30000);
			return () => {
				clearInterval(npInterval);
				clearInterval(reqInterval);
			};
		}
	});

	function copyToClipboard(text: string, type: 'overlay' | 'request') {
		navigator.clipboard.writeText(text).then(() => {
			if (type === 'overlay') {
				copiedOverlay = true;
				setTimeout(() => (copiedOverlay = false), 2000);
			} else {
				copiedRequest = true;
				setTimeout(() => (copiedRequest = false), 2000);
			}
		});
	}

	async function signOut() {
		await authClient.signOut();
	}

	let requestCount = $derived(requests.filter((r) => r.status === 'pending').length);
</script>

<svelte:head>
	<title>Dashboard — Songlink</title>
</svelte:head>

<div class="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
	<div class="mx-auto max-w-4xl">
		<!-- Header -->
		<div class="mb-10 flex items-center justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
				<p class="mt-1 text-zinc-400">
					{$session.data?.user?.name ?? 'Connected'}
				</p>
			</div>
			<button
				onclick={signOut}
				class="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
			>
				Sign out
			</button>
		</div>

		<div class="grid gap-6 md:grid-cols-2">
			<!-- Now Playing -->
			<div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
				<h2 class="mb-4 text-lg font-semibold text-zinc-200">Now Playing</h2>

				{#if npError}
					<p class="text-sm text-red-400">{npError}</p>
				{:else if nowPlaying.isPlaying && nowPlaying.title}
					<div class="flex items-start gap-4">
						{#if nowPlaying.albumArt}
							<img
								src={nowPlaying.albumArt}
								alt={nowPlaying.album ?? 'Album art'}
								class="h-20 w-20 shrink-0 rounded-lg object-cover"
							/>
						{/if}
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold text-white">{nowPlaying.title}</p>
							<p class="truncate text-sm text-zinc-400">{nowPlaying.artist}</p>
							{#if nowPlaying.album}
								<p class="truncate text-xs text-zinc-600">{nowPlaying.album}</p>
							{/if}
							{#if progressText}
								<p class="mt-1 text-xs text-zinc-500">{progressText}</p>
							{/if}
							{#if nowPlaying.spotifyUrl}
								<a
									href={nowPlaying.spotifyUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="mt-2 inline-block rounded-md bg-[#1DB954] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#1ed760]"
								>
									Open in Spotify
								</a>
							{/if}
						</div>
					</div>
				{:else if nowPlaying.notConnected}
					<div class="text-center py-8">
						<p class="text-sm text-zinc-500">Spotify not connected</p>
						<button
							onclick={() => authClient.signIn.social({ provider: 'spotify', callbackURL: '/dashboard' })}
							class="mt-3 rounded-lg bg-[#1DB954] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1ed760]"
						>
							Connect Spotify
						</button>
					</div>
				{:else}
					<p class="text-sm text-zinc-500">Nothing playing right now.</p>
				{/if}
			</div>

			<!-- Overlay Settings -->
			<div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
				<h2 class="mb-4 text-lg font-semibold text-zinc-200">Overlay</h2>

				{#if data.overlayUrl}
					<p class="mb-3 text-sm text-zinc-400">
						Use this URL as a Browser Source in OBS:
					</p>
					<div class="flex items-center gap-2">
						<code class="min-w-0 flex-1 truncate rounded-lg bg-zinc-950 px-3 py-2.5 text-xs text-violet-300">
							{data.overlayUrl}
						</code>
						<button
							onclick={() => copyToClipboard(data.overlayUrl!, 'overlay')}
							class="shrink-0 rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
						>
							{copiedOverlay ? 'Copied!' : 'Copy'}
						</button>
					</div>
					<p class="mt-3 text-xs text-zinc-600">
						Width: 420px · Height: 120px · Transparent background
					</p>
				{:else}
					<div class="rounded-lg border border-amber-800/50 bg-amber-950/20 px-4 py-3">
						<p class="text-sm text-amber-400">
							Set <code class="rounded bg-zinc-950 px-1 text-xs">NOW_PLAYING_API_KEY</code> in
							your Vercel environment variables to enable the overlay.
						</p>
					</div>
				{/if}

				{#if data.requestUrl}
					<p class="mb-2 mt-5 text-sm text-zinc-400">
						Song request submission URL:
					</p>
					<div class="flex items-center gap-2">
						<code class="min-w-0 flex-1 truncate rounded-lg bg-zinc-950 px-3 py-2.5 text-xs text-violet-300">
							{data.requestUrl}
						</code>
						<button
							onclick={() => copyToClipboard(data.requestUrl!, 'request')}
							class="shrink-0 rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
						>
							{copiedRequest ? 'Copied!' : 'Copy'}
						</button>
					</div>
				{/if}
			</div>
		</div>

		<!-- Song Requests -->
		<div class="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
			<div class="mb-4 flex items-center justify-between">
				<div>
					<h2 class="text-lg font-semibold text-zinc-200">Song Requests</h2>
					<p class="text-sm text-zinc-500">
						{requestCount} pending {requestCount === 1 ? 'request' : 'requests'}
					</p>
				</div>
				{#if data.requestUrl}
					<button
						onclick={() => copyToClipboard(data.requestUrl!, 'request')}
						class="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
					>
						{copiedRequest ? 'Copied!' : 'Copy URL'}
					</button>
				{/if}
			</div>

			{#if reqError}
				<p class="text-sm text-red-400">{reqError}</p>
			{:else if requests.length === 0}
				<div class="py-8 text-center">
					<p class="text-sm text-zinc-500">No requests yet.</p>
					<p class="mt-1 text-xs text-zinc-600">
						Share your request URL so viewers can submit songs.
					</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each requests as req (req.id)}
						<div
							class="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-zinc-700 {req.status === 'pending' ? 'border-amber-700/40' : req.status === 'playing' ? 'border-green-800/40' : 'border-zinc-800'}"
						>
							{#if req.albumArt}
								<img
									src={req.albumArt}
									alt=""
									class="h-10 w-10 shrink-0 rounded object-cover"
								/>
							{/if}
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-medium text-white">{req.title}</p>
								<p class="truncate text-xs text-zinc-500">{req.artist}</p>
							</div>
							<div class="flex items-center gap-2 shrink-0">
								{#if req.status === 'pending'}
									<span
										class="rounded-full bg-amber-950/50 px-2.5 py-0.5 text-xs font-medium text-amber-400"
									>
										pending
									</span>
								{:else if req.status === 'playing'}
									<span
										class="rounded-full bg-green-950/50 px-2.5 py-0.5 text-xs font-medium text-green-400"
									>
										playing
									</span>
								{:else}
									<span
										class="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-500"
									>
										played
									</span>
								{/if}
								<span class="text-xs text-zinc-600">{req.requestedBy}</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
