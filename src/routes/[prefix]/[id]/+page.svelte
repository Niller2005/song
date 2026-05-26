<script lang="ts">
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);

	const platformNames: Record<string, string> = {
		spotify: 'Spotify',
		appleMusic: 'Apple Music',
		youtube: 'YouTube',
		youtubeMusic: 'YouTube Music',
		deezer: 'Deezer',
		tidal: 'Tidal',
		amazonMusic: 'Amazon Music',
		soundcloud: 'SoundCloud',
		napster: 'Napster',
		pandora: 'Pandora',
		audiomack: 'Audiomack',
		audius: 'Audius',
		anghami: 'Anghami',
		boomplay: 'Boomplay',
		itunes: 'iTunes',
		yandex: 'Yandex Music'
	};

	const platformColors: Record<string, string> = {
		spotify: 'bg-green-600 hover:bg-green-500',
		appleMusic: 'bg-pink-600 hover:bg-pink-500',
		youtube: 'bg-red-600 hover:bg-red-500',
		youtubeMusic: 'bg-red-700 hover:bg-red-600',
		deezer: 'bg-purple-600 hover:bg-purple-500',
		tidal: 'bg-sky-700 hover:bg-sky-600',
		amazonMusic: 'bg-blue-600 hover:bg-blue-500',
		soundcloud: 'bg-orange-500 hover:bg-orange-400',
		itunes: 'bg-pink-500 hover:bg-pink-400'
	};

	function getPlatformColor(platform: string): string {
		return platformColors[platform] ?? 'bg-zinc-600 hover:bg-zinc-500';
	}

	function getPlatformName(platform: string): string {
		return platformNames[platform] ?? platform;
	}

	let error = $derived(form && 'error' in form ? form.error : null);
	let song = $derived(data.song);
</script>

<div class="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-16 text-zinc-100">
	<div class="w-full max-w-2xl">
		<div class="mb-12 text-center">
			<a href="/" class="inline-block transition-opacity hover:opacity-85">
				<h1 class="mb-2 text-5xl font-bold tracking-tight text-white">Songlink</h1>
			</a>
			<p class="text-lg text-zinc-400">Find your music everywhere</p>
		</div>

		<form
			method="POST"
			action="?/lookup"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update();
					loading = false;
				};
			}}
			class="mb-10"
		>
			<div class="flex gap-3">
				<input
					type="url"
					name="url"
					placeholder="Paste a Spotify, Apple Music, YouTube, or other music link..."
					value={form?.url ?? ''}
					required
					class="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3.5 text-zinc-100 placeholder-zinc-500 transition-colors outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
				/>
				<button
					type="submit"
					disabled={loading}
					class="rounded-xl bg-violet-600 px-7 py-3.5 font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
				>
					{#if loading}
						<span class="inline-flex items-center gap-2">
							<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
									class="opacity-25"
								/>
								<path
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
									class="opacity-75"
								/>
							</svg>
							Searching
						</span>
					{:else}
						Search
					{/if}
				</button>
			</div>
		</form>

		{#if error}
			<div class="mb-8 rounded-xl border border-red-800 bg-red-950/50 px-5 py-4 text-red-300">
				{error}
			</div>
		{/if}

		{#if song}
			<div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
				<div class="mb-6 flex items-center gap-5">
					{#if song.thumbnailUrl}
						<img
							src={song.thumbnailUrl}
							alt="{song.title} cover"
							class="h-24 w-24 rounded-xl object-cover shadow-lg"
						/>
					{/if}
					<div>
						<h2 class="text-2xl font-bold text-white">{song.title}</h2>
						<p class="text-zinc-400">{song.artistName}</p>
						<span
							class="mt-1 inline-block rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400"
						>
							{song.type}
						</span>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
					{#each song.platforms as link (link.platform)}
						<a
							href={link.url}
							target="_blank"
							rel="noopener noreferrer"
							class="flex items-center justify-center rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors {getPlatformColor(
								link.platform
							)}"
						>
							{getPlatformName(link.platform)}
						</a>
					{/each}
				</div>

				{#if song.pageUrl}
					<div class="mt-5 border-t border-zinc-800 pt-4 text-center">
						<a
							href={song.pageUrl}
							target="_blank"
							rel="noopener noreferrer"
							class="text-sm text-violet-400 hover:text-violet-300"
						>
							View on song.link →
						</a>
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
