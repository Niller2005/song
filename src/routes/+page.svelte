<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	let loading = $state(false);

	let error = $derived(form && 'error' in form ? form.error : null);
</script>

<div class="flex min-h-screen flex-col items-center bg-zinc-950 px-4 py-16 text-zinc-100">
	<div class="w-full max-w-2xl">
		<div class="mb-12 text-center">
			<h1 class="mb-2 text-5xl font-bold tracking-tight text-white">Songlink</h1>
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
	</div>
</div>
