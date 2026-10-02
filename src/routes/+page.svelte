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
	import { has, useI18n, type Key } from '$lib/i18n';
	import { queryError } from '$lib/i18n/messages';

	const i18n = useI18n();

	const EXAMPLES =
		'https://github.com/sveltejs/kit, https://vite.dev, https://nodejs.org, https://www.youtube.com/watch?v=dQw4w9WgXcQ';
	const VIEWS: View[] = ['tiles', 'table', 'json'];

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
		VIEWS.includes(viewInAddress as View) ? (viewInAddress as View) : 'tiles'
	);
	let advanced = $state(params.get('advanced') === '1');
	let filter = $state('');
	let only = $state<'all' | 'failed' | 'warnings' | 'ok'>('all');
	let kind = $state('');
	let notice = $state('');

	// The type filter offers the types (page, video, ...) and the services (youtube, github, ...) present
	const typeName = (type: string) => (has(`types.${type}`) ? i18n.t(`types.${type}` as Key) : type);
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
		`${query.loading ? `${query.ready} / ` : ''}${i18n.t('toolbar.links', { count: query.rows.length })}`
	);
	const filtered = $derived(
		shown.length !== query.rows.length ? i18n.t('toolbar.shown', { count: shown.length }) : ''
	);

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

	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	function flash(message: string, ms = 2500) {
		notice = message;
		clearTimeout(noticeTimer);
		if (message) noticeTimer = setTimeout(() => (notice = ''), ms);
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
		if (done) flash(done);
	}

	const copyJson = () => copy(json, i18n.t('notices.jsonCopied'));
	// The address already holds the links, the view and the option: it is the link to share
	const share = () => copy(page.url.href, i18n.t('notices.linkCopied'));

	function download(content: string, type: string, name: string) {
		const url = URL.createObjectURL(new Blob([content], { type }));
		Object.assign(document.createElement('a'), { href: url, download: name }).click();
		URL.revokeObjectURL(url);
	}

	// A short address for the list, kept on the server (lib/server/collections.ts); the notice says so
	async function shortLink() {
		try {
			const res = await fetch('/api/collections', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					urls: query.rows.map((r) => r.url),
					view,
					advanced: query.advanced,
					lang: i18n.lang
				})
			});
			if (!res.ok) throw new Error(String(res.status));
			const { path } = await res.json();
			await copy(new URL(path, page.url).href, '');
			flash(i18n.t('notices.shortLinkCopied', { url: new URL(path, page.url).href }), 8000);
		} catch {
			flash(i18n.t('notices.shortLinkFailed'));
		}
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
	<title>{i18n.t('meta.title')}</title>
	<meta name="description" content={i18n.t('meta.description')} />
</svelte:head>

<main class="page">
	<UrlForm
		bind:text
		bind:advanced
		showAdvanced={view !== 'tiles'}
		loading={query.loading}
		ready={query.ready}
		total={query.rows.length}
		error={query.error && queryError(i18n.t, query.error)}
		onsubmit={fetchLinks}
		onstop={() => query.stop()}
	/>

	<RecentList {recent} onopen={reopen} />

	{#if query.rows.length}
		<div class="toolbar">
			<p class="toolbar__summary" aria-live="polite">
				{summary}{#if query.failed}<span class="toolbar__failed"
						>{i18n.t('toolbar.failed', { count: query.failed })}</span
					>{/if}{filtered}
			</p>
			<div class="toolbar__tabs" role="tablist" aria-label={i18n.t('views.label')}>
				{#each VIEWS as v (v)}
					<button
						type="button"
						role="tab"
						aria-selected={view === v}
						class:is-active={view === v}
						onclick={() => show(v)}>{i18n.t(`views.${v}`)}</button
					>
				{/each}
			</div>
			<input
				class="toolbar__filter"
				type="search"
				placeholder={i18n.t('toolbar.filter')}
				aria-label={i18n.t('toolbar.filterLabel')}
				bind:value={filter}
			/>
			<select class="toolbar__select" aria-label={i18n.t('toolbar.show')} bind:value={only}>
				<option value="all">{i18n.t('toolbar.all')}</option>
				<option value="ok">{i18n.t('toolbar.ok')}</option>
				<option value="failed">{i18n.t('toolbar.failedOnly')}</option>
				{#if query.advanced}
					<option value="warnings">{i18n.t('toolbar.warnings')}</option>
				{/if}
			</select>
			{#if types.length + services.length > 1}
				<select class="toolbar__select" aria-label={i18n.t('toolbar.type')} bind:value={kind}>
					<option value="">{i18n.t('toolbar.allTypes')}</option>
					<optgroup label={i18n.t('toolbar.typeGroup')}>
						{#each types as t (t)}
							<option value={t}>{typeName(t)}</option>
						{/each}
					</optgroup>
					{#if services.length}
						<optgroup label={i18n.t('toolbar.siteGroup')}>
							{#each services as t (t)}
								<option value={t}>{t}</option>
							{/each}
						</optgroup>
					{/if}
				</select>
			{/if}
			<div class="toolbar__actions">
				<button type="button" onclick={share}>{i18n.t('toolbar.share')}</button>
				<button
					type="button"
					onclick={shortLink}
					disabled={query.loading}
					title={i18n.t('toolbar.shortLinkHint')}>{i18n.t('toolbar.shortLink')}</button
				>
				{#if query.failed && !query.loading}
					<button type="button" onclick={() => query.retryFailed()}>
						{i18n.t('toolbar.retry', { count: query.failed })}
					</button>
				{/if}
				{#if view !== 'tiles'}
					<button type="button" onclick={copyJson}>{i18n.t('toolbar.copyJson')}</button>
					<button type="button" onclick={downloadJson}>{i18n.t('toolbar.downloadJson')}</button>
					<button type="button" onclick={downloadCsv}>{i18n.t('toolbar.downloadCsv')}</button>
				{/if}
			</div>
		</div>
		{#if notice}
			<p class="notice" role="status">{notice}</p>
		{/if}
		{#if removed}
			<p class="notice" role="status">
				{i18n.t('notices.removed', { name: removed.row.title || removed.row.url })}
				<button type="button" class="notice__undo" onclick={undoRemove}
					>{i18n.t('notices.undo')}</button
				>
			</p>
		{/if}
		{#if view === 'table' && !query.advanced && advanced}
			<p class="notice">{i18n.t('notices.fetchAgain')}</p>
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
