<script lang="ts">
	import { page } from '$app/state';
	import { alternates, pageIn } from '$lib/seo';

	/* Canonical address and language versions of an indexed page (src/lib/seo.ts) */
	let { path }: { path: string } = $props();

	const lang = $derived(page.url.searchParams.get('lang') ?? undefined);
</script>

<svelte:head>
	<link rel="canonical" href={pageIn(page.url.origin, path, lang)} />
	{#each alternates(page.url.origin, path) as a (a.hreflang)}
		<link rel="alternate" hreflang={a.hreflang} href={a.href} />
	{/each}
</svelte:head>
