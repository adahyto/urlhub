<script lang="ts">
    import Tiles from '$lib/components/Tiles.svelte';
    import UrlForm from '$lib/components/UrlForm.svelte';
    import type { TileUrl } from '$lib/types';
    let urls = $state<TileUrl[]>([]);
    const autoFetch = true;
</script>
<br>
<UrlForm bind:urls autoFetch />
<br>
{#if urls.length > 0}
	<Tiles {urls} />
{/if}

