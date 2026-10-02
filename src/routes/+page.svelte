<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { onMount } from 'svelte';
	import Tiles from '$lib/components/Tiles.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import JsonView from '$lib/components/JsonView.svelte';
	import UrlForm from '$lib/components/UrlForm.svelte';
	import RecentList from '$lib/components/RecentList.svelte';
	import { RecentQueries, type Recent } from '$lib/history.svelte';
	import { LinkQuery, asCsv, asJson } from '$lib/query.svelte';
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
	const recent = new RecentQueries();
	// Old shared links put "-" between the links; one per line reads better (ldb-api splits them either way)
	let text = $state(linksInAddress.replace(/[\s,;-]+(?=https?:\/\/)/gi, '\n').trim() || EXAMPLES);
	let view = $state<View>(
		VIEWS.some((v) => v.id === viewInAddress) ? (viewInAddress as View) : 'tiles'
	);
	let advanced = $state(params.get('advanced') === '1');
	let filter = $state('');
	let only = $state<'all' | 'failed' | 'warnings' | 'ok'>('all');
	let kind = $state('');
	let notice = $state('');

	// The type filter offers the types (page, video, ...) and the services (youtube, github, ...) present
	const distinct = (values: (string | undefined)[]) =>
		values.filter((v, i, all): v is string => !!v && all.indexOf(v) === i).sort();
	const types = $derived(distinct(query.rows.filter((r) => !r.pending).map((r) => r.type)));
	const services = $derived(distinct(query.rows.filter((r) => !r.pending).map((r) => r.service)));

	const matches = (r: Row, words: string) =>
		!words ||
		[r.url, r.title, r.desc, r.channel, r.author, r.siteName, r.error, r.type, r.service].some(
			(v) => (v ?? '').toLowerCase().includes(words)
		);
	const shows = (r: Row) =>
		only === 'all' ||
		(only === 'failed' && !!r.error) ||
		(only === 'ok' && !r.error && !r.pending) ||
		(only === 'warnings' && !!r.warnings?.length);

	const shown = $derived.by(() => {
		const words = filter.trim().toLowerCase();
		return query.rows.filter(
			(r) => matches(r, words) && shows(r) && (!kind || r.type === kind || r.service === kind)
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
		removed = null;
		filter = '';
		only = 'all';
		kind = '';
		// Tiles show the basic details only, so they do not ask for the heavier advanced ones
		const asked = advanced && view !== 'tiles';
		query.run(text, asked, (urls) => {
			updateAddress(urls);
			recent.add(urls, view, asked);
		});
	}

	/** A recent query comes back with its links, view and option, and is fetched again */
	function reopen(entry: Recent) {
		text = entry.urls.join('\n');
		view = entry.view;
		advanced = entry.advanced;
		fetchLinks();
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Editing the list: the address and the field follow, so Share gives the edited list. Moving needs the
	// whole list in view (no filter); removing works any time a query is not filling the list.
	const removable = $derived(!query.loading);
	const movable = $derived(!query.loading && !filter.trim() && only === 'all' && !kind);
	let removed = $state<{ row: Row; index: number } | null>(null);
	let removedTimer: ReturnType<typeof setTimeout> | undefined;

	function listChanged() {
		const urls = query.rows.map((r) => r.url);
		text = urls.join('\n');
		updateAddress(urls);
	}

	function remove(url: string) {
		const taken = query.remove(url);
		if (!taken) return;
		removed = taken;
		clearTimeout(removedTimer);
		removedTimer = setTimeout(() => (removed = null), 8000);
		listChanged();
	}

	function undoRemove() {
		if (!removed) return;
		query.restore(removed.row, removed.index);
		removed = null;
		listChanged();
	}

	function move(url: string, to: number | { before: string }) {
		query.move(url, to);
		listChanged();
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
	async function copy(content: string, done: string) {
		try {
			await navigator.clipboard.writeText(content);
		} catch {
			const area = Object.assign(document.createElement('textarea'), { value: content });
			document.body.append(area);
			area.select();
			document.execCommand('copy');
			area.remove();
		}
		flash(done);
	}

	const copyJson = () => copy(json, 'JSON copied');
	// The address already holds the links, the view and the option: it is the link to share
	const share = () => copy(page.url.href, 'Link copied: it opens these results');

	function download(content: string, type: string, name: string) {
		const url = URL.createObjectURL(new Blob([content], { type }));
		Object.assign(document.createElement('a'), { href: url, download: name }).click();
		URL.revokeObjectURL(url);
	}

	const downloadJson = () => download(json, 'application/json', 'urlhub-links.json');
	// Excel and Google Sheets open it; the filters apply, as for JSON
	const downloadCsv = () => download(asCsv(shown), 'text/csv;charset=utf-8', 'urlhub-links.csv');

	// Only shared links (?urls=...) load by themselves; the examples wait for a click
	onMount(() => {
		recent.load();
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

	<RecentList {recent} onopen={reopen} />

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
			<select class="toolbar__select" aria-label="Show" bind:value={only}>
				<option value="all">All links</option>
				<option value="ok">Without errors</option>
				<option value="failed">Failed only</option>
				{#if query.advanced}
					<option value="warnings">With SEO warnings</option>
				{/if}
			</select>
			{#if types.length + services.length > 1}
				<select class="toolbar__select" aria-label="Type" bind:value={kind}>
					<option value="">All types</option>
					<optgroup label="Type">
						{#each types as t (t)}
							<option value={t}>{t}</option>
						{/each}
					</optgroup>
					{#if services.length}
						<optgroup label="Site">
							{#each services as t (t)}
								<option value={t}>{t}</option>
							{/each}
						</optgroup>
					{/if}
				</select>
			{/if}
			<div class="toolbar__actions">
				<button type="button" onclick={share}>Share</button>
				{#if query.failed && !query.loading}
					<button type="button" onclick={() => query.retryFailed()}>
						Retry {query.failed} failed
					</button>
				{/if}
				{#if view !== 'tiles'}
					<button type="button" onclick={copyJson}>Copy JSON</button>
					<button type="button" onclick={downloadJson}>Download JSON</button>
					<button type="button" onclick={downloadCsv}>Download CSV</button>
				{/if}
			</div>
		</div>
		{#if notice}
			<p class="notice" role="status">{notice}</p>
		{/if}
		{#if removed}
			<p class="notice" role="status">
				Removed {removed.row.title || removed.row.url}
				<button type="button" class="notice__undo" onclick={undoRemove}>Undo</button>
			</p>
		{/if}
		{#if view === 'table' && !query.advanced && advanced}
			<p class="notice">Fetch again to get the advanced details.</p>
		{/if}

		{#if view === 'tiles'}
			<Tiles urls={shown.map(toTileUrl)} {removable} {movable} onremove={remove} onmove={move} />
		{:else if view === 'table'}
			<ResultsTable
				rows={shown}
				advanced={query.advanced}
				{removable}
				{movable}
				onremove={remove}
				onmove={move}
			/>
		{:else}
			<JsonView {json} />
		{/if}
	{/if}
</main>

<style>
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
		color: var(--error);
	}

	.toolbar__tabs {
		display: inline-flex;
		padding: 0.2rem;
		background: var(--surface-3);
		border-radius: 0.6rem;
	}

	.toolbar__tabs button,
	.toolbar__actions button {
		padding: 0.4rem 0.8rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--ink);
		background: transparent;
		border: 0;
		border-radius: 0.45rem;
		cursor: pointer;
	}

	.toolbar__tabs button.is-active {
		background: var(--surface);
		box-shadow: 0 1px 3px var(--shadow);
	}

	.toolbar__filter {
		flex: 1 1 12rem;
		min-width: 0;
		padding: 0.45rem 0.75rem;
		font: inherit;
		font-size: 0.85rem;
		border: 1px solid var(--border);
		border-radius: 0.6rem;
	}

	/* The browser's own arrow sits against the edge; this one keeps the same space as the text on the left */
	.toolbar__select {
		appearance: none;
		padding: 0.45rem 2rem 0.45rem 0.75rem;
		font: inherit;
		font-size: 0.8rem;
		color: var(--ink);
		background: var(--surface)
			url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%231a1a1a' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
			no-repeat right 0.75rem center;
		border: 1px solid var(--border);
		border-radius: 0.6rem;
		cursor: pointer;
	}

	/* The arrow is a picture, so the dark theme needs its own (light) one */
	@media (prefers-color-scheme: dark) {
		.toolbar__select {
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23ececea' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		}
	}

	.toolbar__select:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.toolbar__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.toolbar__actions button {
		border: 1px solid var(--border);
	}

	.notice {
		width: 100%;
		max-width: 72rem;
		margin: -0.5rem auto 0;
		padding-inline: 0.5rem;
		box-sizing: border-box;
		font-size: 0.8rem;
		color: var(--ink-3);
	}

	.notice__undo {
		margin-left: 0.5rem;
		padding: 0;
		font: inherit;
		font-weight: 600;
		color: var(--ink);
		text-decoration: underline;
		background: none;
		border: 0;
		cursor: pointer;
	}

	.page > :global(.table),
	.page > :global(.json) {
		width: 100%;
		max-width: 72rem;
		margin-inline: auto;
	}
</style>
