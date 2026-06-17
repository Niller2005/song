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
	let queuingId = $state<string | null>(null);

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

	async function queueRequest(id: string) {
		queuingId = id;
		try {
			const res = await fetch(`/api/requests/${id}`, { method: 'PATCH' });
			if (!res.ok) {
				const body = await res.json();
				throw new Error(body.error ?? `HTTP ${res.status}`);
			}
			const updated: SongRequest = await res.json();
			requests = requests.map((r) => (r.id === id ? updated : r));
		} catch (e) {
			alert(e instanceof Error ? e.message : 'Failed to queue');
		} finally {
			queuingId = null;
		}
	}

	let requestCount = $derived(requests.filter((r) => r.status === 'pending').length);
</script>

<svelte:head>
	<title>Dashboard — Songlink</title>
</svelte:head>

{#if $session.data?.user}
	<div class="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
		<div class="mx-auto max-w-4xl">
			<!-- Header -->
			<div class="mb-10 flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
					<p class="mt-1 text-zinc-400">{$session.data.user.name}</p>
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
						<div class="py-8 text-center">
							<p class="text-sm text-zinc-500">Spotify not connected</p>
							<button
								onclick={() =>
									authClient.signIn.social({ provider: 'spotify', callbackURL: '/dashboard' })}
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
						<p class="mb-3 text-sm text-zinc-400">Use this URL as a Browser Source in OBS:</p>
						<div class="flex items-center gap-2">
							<code
								class="min-w-0 flex-1 truncate rounded-lg bg-zinc-950 px-3 py-2.5 text-xs text-violet-300"
							>
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
								Set <code class="rounded bg-zinc-950 px-1 text-xs">NOW_PLAYING_API_KEY</code> in your
								Vercel environment variables to enable the overlay.
							</p>
						</div>
					{/if}

					{#if data.requestUrl}
						<p class="mt-5 mb-2 text-sm text-zinc-400">Song request submission URL:</p>
						<div class="flex items-center gap-2">
							<code
								class="min-w-0 flex-1 truncate rounded-lg bg-zinc-950 px-3 py-2.5 text-xs text-violet-300"
							>
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
								class="flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors hover:border-zinc-700 {req.status ===
								'pending'
									? 'border-amber-700/40'
									: req.status === 'playing'
										? 'border-green-800/40'
										: 'border-zinc-800'}"
							>
								{#if req.albumArt}
									<img src={req.albumArt} alt="" class="h-10 w-10 shrink-0 rounded object-cover" />
								{/if}
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-white">{req.title}</p>
									<p class="truncate text-xs text-zinc-500">{req.artist}</p>
								</div>
								<div class="flex shrink-0 items-center gap-2">
									{#if req.status === 'pending'}
										{#if req.spotifyTrackId}
											<button
												onclick={() => queueRequest(req.id)}
												disabled={queuingId === req.id}
												class="rounded-md bg-[#1DB954] px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#1ed760] disabled:opacity-50"
											>
												{queuingId === req.id ? 'Queuing…' : 'Queue'}
											</button>
										{/if}
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
{:else}
	<div class="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-24 text-zinc-100">
		<div class="w-full max-w-md text-center">
			<h1 class="mb-3 text-4xl font-bold tracking-tight text-white">Dashboard</h1>
			<p class="mb-10 text-zinc-400">Sign in with Spotify to manage your stream tools.</p>

			<button
				onclick={() => authClient.signIn.social({ provider: 'spotify', callbackURL: '/dashboard' })}
				class="inline-flex items-center gap-3 rounded-xl bg-[#1DB954] px-8 py-4 text-lg font-semibold text-white transition-colors hover:bg-[#1ed760]"
			>
				<svg class="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"
					/>
				</svg>
				Sign in with Spotify
			</button>
		</div>
	</div>
{/if}
