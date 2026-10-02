<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { onMount } from 'svelte';
	import Tiles from '$lib/components/Tiles.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import JsonView from '$lib/components/JsonView.svelte';
	import UrlForm from '$lib/components/UrlForm.svelte';
	import { LinkQuery, asJson } from '$lib/query.svelte';
	import { toTileUrl } from '$lib/tiles';
	import type { Row, View } from '$lib/types';

	const EXAMPLES =
		'https://github.com/sveltejs/kit, https://vite.dev, https://nodejs.org, https://www.youtube.com/watch?v=dQw4w9WgXcQ';
	const VIEWS: { id: View; label: string }[] = [
		{ id: 'tiles', label: 'Tiles' },
		{ id: 'table', label: 'Table' },
		{ id: 'json', label: 'JSON' }
	];

	// The address holds the list, the view and the advanced option, so a shared link opens the same results:
	// ?urls=<links separated by spaces>&view=table&advanced=1 (tiles and basic are the defaults, left out)
	const params = page.url.searchParams;
	const linksInAddress = params.get('urls') ?? '';
	const viewInAddress = params.get('view');

	const query = new LinkQuery();
	// Old shared links put "-" between the links; one per line reads better (ldb-api splits them either way)
	let text = $state(linksInAddress.replace(/[\s,;-]+(?=https?:\/\/)/gi, '\n').trim() || EXAMPLES);
	let view = $state<View>(
		VIEWS.some((v) => v.id === viewInAddress) ? (viewInAddress as View) : 'tiles'
	);
	let advanced = $state(params.get('advanced') === '1');
	let filter = $state('');
	let notice = $state('');

	const shown = $derived.by(() => {
		const words = filter.trim().toLowerCase();
		if (!words) return query.rows;
		return query.rows.filter((r: Row) =>
			[r.url, r.title, r.desc, r.channel, r.author, r.siteName, r.error, r.type, r.service].some(
				(v) => (v ?? '').toLowerCase().includes(words)
			)
		);
	});
	const json = $derived(asJson(shown));
	const summary = $derived(
		`${query.loading ? `${query.ready} / ` : ''}${query.rows.length} ${query.rows.length === 1 ? 'link' : 'links'}`
	);
	const filtered = $derived(shown.length !== query.rows.length ? ` · ${shown.length} shown` : '');

	function updateAddress(urls: string[] | null) {
		const next = new SvelteURLSearchParams(page.url.searchParams);
		if (urls) next.set('urls', urls.join(' '));
		if (view === 'tiles') next.delete('view');
		else next.set('view', view);
		if (query.advanced && view !== 'tiles') next.set('advanced', '1');
		else next.delete('advanced');
		const search = next.toString();
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- same page (pathname already resolved), only the query changes
		goto(`${page.url.pathname}${search ? `?${search}` : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function fetchLinks() {
		filter = '';
		// Tiles show the basic details only, so they do not ask for the heavier advanced ones
		query.run(text, advanced && view !== 'tiles', (urls) => updateAddress(urls));
	}

	function show(next: View) {
		view = next;
		updateAddress(null);
	}

	function flash(message: string) {
		notice = message;
		setTimeout(() => (notice = ''), 2500);
	}

	// navigator.clipboard needs HTTPS; this site is plain HTTP, so fall back to the old way
	async function copyJson() {
		try {
			await navigator.clipboard.writeText(json);
		} catch {
			const area = Object.assign(document.createElement('textarea'), { value: json });
			document.body.append(area);
			area.select();
			document.execCommand('copy');
			area.remove();
		}
		flash('JSON copied');
	}

	function downloadJson() {
		const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
		Object.assign(document.createElement('a'), {
			href: url,
			download: 'urlhub-links.json'
		}).click();
		URL.revokeObjectURL(url);
	}

	// Only shared links (?urls=...) load by themselves; the examples wait for a click
	onMount(() => {
		if (linksInAddress.trim()) fetchLinks();
		return () => query.stop();
	});
</script>

<svelte:head>
	<title>urlhub – link previews</title>
	<meta
		name="description"
		content="Paste links and see them as tiles or a table: picture, title and description of each page, YouTube duration, SEO warnings."
	/>
</svelte:head>

<main class="page">
	<UrlForm
		bind:text
		bind:advanced
		showAdvanced={view !== 'tiles'}
		loading={query.loading}
		ready={query.ready}
		total={query.rows.length}
		error={query.error}
		onsubmit={fetchLinks}
		onstop={() => query.stop()}
	/>

	{#if query.rows.length}
		<div class="toolbar">
			<p class="toolbar__summary" aria-live="polite">
				{summary}{#if query.failed}<span class="toolbar__failed">, {query.failed} failed</span
					>{/if}{filtered}
			</p>
			<div class="toolbar__tabs" role="tablist" aria-label="View">
				{#each VIEWS as v (v.id)}
					<button
						type="button"
						role="tab"
						aria-selected={view === v.id}
						class:is-active={view === v.id}
						onclick={() => show(v.id)}>{v.label}</button
					>
				{/each}
			</div>
			<input
				class="toolbar__filter"
				type="search"
				placeholder="Filter by text, link or error"
				aria-label="Filter"
				bind:value={filter}
			/>
			{#if view !== 'tiles'}
				<div class="toolbar__actions">
					<button type="button" onclick={copyJson}>Copy JSON</button>
					<button type="button" onclick={downloadJson}>Download JSON</button>
				</div>
			{/if}
		</div>
		{#if notice}
			<p class="notice" role="status">{notice}</p>
		{/if}
		{#if view === 'table' && !query.advanced && advanced}
			<p class="notice">Fetch again to get the advanced details.</p>
		{/if}

		{#if view === 'tiles'}
			<Tiles urls={shown.map(toTileUrl)} />
		{:else if view === 'table'}
			<ResultsTable rows={shown} />
		{:else}
			<JsonView {json} />
		{/if}
	{/if}
</main>

<style>
	:global(body) {
		margin: 0;
	}

	.page {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		box-sizing: border-box;
		padding: 1.5rem 0.5rem 3rem;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		width: 100%;
		max-width: 72rem;
		margin-inline: auto;
		box-sizing: border-box;
		padding-inline: 0.5rem;
	}

	.toolbar__summary {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.toolbar__failed {
		color: #c0392b;
	}

	.toolbar__tabs {
		display: inline-flex;
		padding: 0.2rem;
		background: #f0f0f0;
		border-radius: 0.6rem;
	}

	.toolbar__tabs button,
	.toolbar__actions button {
		padding: 0.4rem 0.8rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: #1a1a1a;
		background: transparent;
		border: 0;
		border-radius: 0.45rem;
		cursor: pointer;
	}

	.toolbar__tabs button.is-active {
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
	}

	.toolbar__filter {
		flex: 1 1 12rem;
		min-width: 0;
		padding: 0.45rem 0.75rem;
		font: inherit;
		font-size: 0.85rem;
		border: 1px solid #e2e2e2;
		border-radius: 0.6rem;
	}

	.toolbar__actions {
		display: flex;
		gap: 0.25rem;
	}

	.toolbar__actions button {
		border: 1px solid #e2e2e2;
	}

	.notice {
		width: 100%;
		max-width: 72rem;
		margin: -0.5rem auto 0;
		padding-inline: 0.5rem;
		box-sizing: border-box;
		font-size: 0.8rem;
		color: #555;
	}

	.page > :global(.table),
	.page > :global(.json) {
		width: 100%;
		max-width: 72rem;
		margin-inline: auto;
	}
</style>
