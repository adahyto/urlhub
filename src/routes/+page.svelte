<script lang="ts">
    import Tiles from '$lib/components/Tiles.svelte';
    import UrlForm from '$lib/components/UrlForm.svelte';
    import type { TileUrl } from '$lib/types';
    let urls = $state<TileUrl[]>([]);
    const autoFetch = true;
</script>

<svelte:head>
	<title>urlhub – link previews</title>
	<meta
		name="description"
		content="Paste links and see them as tiles: picture, title and description of each page, YouTube duration."
	/>
</svelte:head>
<br>
<UrlForm bind:urls autoFetch />
<br>
{#if urls.length > 0}
	<Tiles {urls} />
{/if}

