<script lang="ts">
	import { authClient } from '$lib/auth-client';

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

	const session = authClient.useSession();

	let history: HistoryEntry[] = $state([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function fetchHistory() {
		try {
			const res = await fetch('/api/history');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			history = await res.json();
			error = null;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to fetch';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if ($session.data?.user) {
			fetchHistory();
		}
	});

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Listening History — Songlink</title>
</svelte:head>

<div class="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-16 text-zinc-100">
	<div class="w-full max-w-2xl">
		<div class="mb-12 text-center">
			<h1 class="mb-2 text-4xl font-bold tracking-tight text-white">Listening History</h1>
			<p class="text-zinc-400">Your recently played tracks</p>
		</div>

		{#if $session.isPending}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="text-zinc-400">Loading...</p>
			</div>
		{:else if !$session.data?.user}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="mb-4 text-zinc-300">Sign in to view your listening history.</p>
				<a
					href="/now-playing"
					class="inline-block rounded-xl bg-violet-600 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-violet-500"
				>
					Go to Now Playing
				</a>
			</div>
		{:else if loading}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="text-zinc-400">Loading history...</p>
			</div>
		{:else if error}
			<div class="rounded-xl border border-red-800 bg-red-950/50 px-5 py-4 text-red-300">
				{error}
			</div>
		{:else if history.length === 0}
			<div class="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
				<p class="text-zinc-400">No listening history yet.</p>
				<p class="mt-2 text-sm text-zinc-500">Play something on Spotify to start tracking.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each history as entry}
					<div class="flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
						{#if entry.albumArt}
							<img
								src={entry.albumArt}
								alt={entry.album ?? ''}
								class="h-14 w-14 shrink-0 rounded-lg object-cover"
							/>
						{:else}
							<div
								class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-500"
							>
								♪
							</div>
						{/if}
						<div class="min-w-0 flex-1">
							{#if entry.spotifyUrl}
								<a
									href={entry.spotifyUrl}
									target="_blank"
									rel="noopener noreferrer"
									class="block truncate font-semibold text-white hover:text-violet-400"
								>
									{entry.title}
								</a>
							{:else}
								<p class="truncate font-semibold text-white">{entry.title}</p>
							{/if}
							<p class="truncate text-sm text-zinc-400">{entry.artist}</p>
							{#if entry.album}
								<p class="truncate text-xs text-zinc-500">{entry.album}</p>
							{/if}
						</div>
						<div class="shrink-0 text-right">
							<p class="text-xs text-zinc-500">{formatDate(entry.playedAt)}</p>
							<p class="text-xs text-zinc-600">{formatTime(entry.playedAt)}</p>
						</div>
					</div>
				{/each}
			</div>

			<div class="mt-8 flex justify-center gap-4">
				<a
					href="/now-playing"
					class="rounded-xl bg-zinc-800 px-5 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-700"
				>
					Now Playing
				</a>
				<a
					href="/"
					class="rounded-xl bg-zinc-800 px-5 py-3 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-700"
				>
					Home
				</a>
			</div>
		{/if}
	</div>
</div>