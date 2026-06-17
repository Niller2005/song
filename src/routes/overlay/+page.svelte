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
	}

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

	let visible = $state(true);
	const apiKey =
		typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('key') : null;
	const apiUrl = apiKey ? `/api/now-playing?key=${encodeURIComponent(apiKey)}` : '/api/now-playing';

	async function fetchNowPlaying() {
		try {
			const res = await fetch(apiUrl);
			if (!res.ok) return;
			const json = await res.json();
			if (json.notConnected) return;

			const prevTitle = data.title;

			data = json;

			if (json.isPlaying && json.title && json.title !== prevTitle) {
				visible = false;
				await new Promise((r) => setTimeout(r, 300));
				visible = true;
			}
		} catch {
			// Silent fail for overlay
		}
	}

	$effect(() => {
		fetchNowPlaying();
		const interval = setInterval(fetchNowPlaying, 5000);
		return () => clearInterval(interval);
	});
</script>

<svelte:head>
	<title>Now Playing Overlay</title>
	<style>
		:global(body) {
			margin: 0 !important;
			padding: 0 !important;
			background: transparent !important;
			overflow: hidden !important;
		}
	</style>
</svelte:head>

<div class="overlay-container" class:visible>
	{#if data.isPlaying && data.title}
		<div class="now-playing" class:fade-in={visible} class:fade-out={!visible}>
			{#if data.albumArt}
				<img src={data.albumArt} alt="" class="album-art" />
			{/if}
			<div class="track-info">
				<p class="title">{data.title}</p>
				<p class="artist">{data.artist}</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.overlay-container {
		position: fixed;
		bottom: 40px;
		left: 40px;
		transition: opacity 0.3s ease;
	}

	.overlay-container:not(.visible) {
		opacity: 0;
	}

	.now-playing {
		display: flex;
		align-items: center;
		gap: 16px;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(12px);
		border-radius: 16px;
		padding: 12px 20px 12px 12px;
		max-width: 420px;
	}

	.album-art {
		width: 64px;
		height: 64px;
		border-radius: 8px;
		object-fit: cover;
		flex-shrink: 0;
	}

	.track-info {
		min-width: 0;
	}

	.title {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
		font-size: 16px;
		font-weight: 600;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 0;
	}

	.artist {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.7);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: 2px 0 0;
	}

	.fade-in {
		animation: fadeIn 0.3s ease forwards;
	}

	.fade-out {
		animation: fadeOut 0.3s ease forwards;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes fadeOut {
		from {
			opacity: 1;
			transform: translateY(0);
		}
		to {
			opacity: 0;
			transform: translateY(8px);
		}
	}
</style>
