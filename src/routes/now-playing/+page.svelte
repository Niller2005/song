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
		notConnected?: boolean;
	}

	const session = authClient.useSession();

	let data: NowPlayingData = $state({
		isPlaying: false,
		title: null,
		artist: null,
		album: null,
		albumArt: null,
		progress: null,
		duration: null,
		spotifyUrl: null
	});

	let error = $state<string | null>(null);

	function formatMs(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	let progressText = $derived(
		data.progress != null && data.duration != null
			? `${formatMs(data.progress)} / ${formatMs(data.duration)}`
			: ''
	);

	async function fetchNowPlaying() {
		try {
			const res = await fetch('/api/now-playing');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const json = await res.json();
			data = json;
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch';
		}
	}

	$effect(() => {
		if ($session.data?.user) {
			fetchNowPlaying();
			const interval = setInterval(fetchNowPlaying, 10000);
			return () => clearInterval(interval);
		}
	});

	async function signInWithSpotify() {
		await authClient.signIn.social({
			provider: 'spotify',
			callbackURL: '/now-playing'
		});
	}
</script>

<svelte:head>
	<title>Now Playing — Songlink</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-16 text-zinc-100">
	<div class="w-full max-w-2xl">
		<div class="mb-12 text-center">
			<h1 class="mb-2 text-4xl font-bold tracking-tight text-white">Now Playing</h1>
			<p class="text-zinc-400">Your current Spotify track</p>
		</div>

		{#if $session.isPending}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="text-zinc-400">Loading...</p>
			</div>
		{:else if !$session.data?.user}
			<div class="mb-8 rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="mb-4 text-zinc-300">Connect your Spotify account to see what's playing.</p>
				<button
					onclick={signInWithSpotify}
					class="inline-block rounded-xl bg-[#1DB954] px-7 py-3.5 font-semibold text-white transition-colors hover:bg-[#1ed760]"
				>
					Sign in with Spotify
				</button>
			</div>
		{:else if data.notConnected}
			<div class="mb-8 rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="mb-4 text-zinc-300">Connect your Spotify account to see what's playing.</p>
				<button
					onclick={signInWithSpotify}
					class="inline-block rounded-xl bg-[#1DB954] px-7 py-3.5 font-semibold text-white transition-colors hover:bg-[#1ed760]"
				>
					Connect Spotify
				</button>
			</div>
		{:else if data.isPlaying && data.title}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-6">
				<div class="flex items-start gap-6">
					{#if data.albumArt}
						<img
							src={data.albumArt}
							alt={data.album ?? 'Album art'}
							class="h-40 w-40 shrink-0 rounded-lg object-cover"
						/>
					{/if}
					<div class="min-w-0 flex-1">
						<h2 class="mb-1 truncate text-2xl font-bold text-white">{data.title}</h2>
						<p class="mb-1 text-lg text-zinc-300">{data.artist}</p>
						{#if data.album}
							<p class="mb-3 text-sm text-zinc-500">{data.album}</p>
						{/if}
						{#if progressText}
							<p class="text-sm text-zinc-400">{progressText}</p>
						{/if}
						{#if data.spotifyUrl}
							<a
								href={data.spotifyUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="mt-4 inline-block rounded-lg bg-[#1DB954] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1ed760]"
							>
								Open in Spotify
							</a>
						{/if}
					</div>
				</div>
			</div>
		{:else}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="text-zinc-400">Nothing is playing right now.</p>
				<p class="mt-2 text-sm text-zinc-500">Play something on Spotify and it'll show up here.</p>
			</div>
		{/if}

		{#if error}
			<div class="mt-4 rounded-xl border border-red-800 bg-red-950/50 px-5 py-4 text-red-300">
				{error}
			</div>
		{/if}

		<div class="mt-8 flex justify-center gap-4">
			<a href="/history" class="text-sm text-violet-400 hover:underline">History →</a>
			<span class="text-zinc-700">|</span>
			<a href="/overlay" class="text-sm text-zinc-500 hover:underline">Stream overlay →</a>
		</div>
	</div>
</div>