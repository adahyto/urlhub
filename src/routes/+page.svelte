<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { onMount } from 'svelte';
	import Tiles from '$lib/components/Tiles.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import JsonView from '$lib/components/JsonView.svelte';
	import UrlForm from '$lib/components/UrlForm.svelte';
	import RecentMenu from '$lib/components/RecentMenu.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import SeoLinks from '$lib/components/SeoLinks.svelte';
	import { RecentQueries, type Recent } from '$lib/history.svelte';
	import { LinkQuery, asCsv, asJson, isFailed } from '$lib/query.svelte';
	import { toTileUrl } from '$lib/tiles';
	import type { Row, View } from '$lib/types';
	import { has, useI18n, type Key } from '$lib/i18n';
	import { queryError } from '$lib/i18n/messages';

	const i18n = useI18n();

	// "Try an example": links checked to work, each with a picture; Wikipedia and kosmos in the page's language
	const examples = (lang: string) => [
		'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
		'https://vimeo.com/1084537',
		'https://github.com/sveltejs/kit',
		`https://${lang}.wikipedia.org/wiki/Mars`,
		'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
		`https://kosmos.info.pl/${lang}/home`
	];
	const VIEWS: View[] = ['tiles', 'table', 'json'];

	// The address holds the list, the view and the advanced option, so a shared link opens the same results:
	// ?urls=<links separated by spaces>&view=table&advanced=1 (tiles and basic are the defaults, left out)
	const params = page.url.searchParams;
	const linksInAddress = params.get('urls') ?? '';
	const viewInAddress = params.get('view');

	const query = new LinkQuery();
	const recent = new RecentQueries();
	// Old shared links put "-" between the links; one per line reads better (ldb-api splits them either way)
	let text = $state(linksInAddress.replace(/[\s,;-]+(?=https?:\/\/)/gi, '\n').trim());
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
		(only === 'failed' && isFailed(r)) ||
		(only === 'ok' && !isFailed(r) && !r.pending) ||
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
			// The field shows what the set holds: the links found, not the text they were pasted in
			text = urls.join('\n');
			updateAddress(urls);
			recent.add(urls, view, asked);
		});
	}

	function tryExample() {
		text = examples(i18n.lang).join('\n');
		fetchLinks();
	}

	// SEO details show in the table and the JSON: asking for them from the tiles opens the table
	function advancedChanged(on: boolean) {
		if (on && view === 'tiles') show('table');
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

	// What a messenger shows for a shared link: made from the list in the address alone, so the server renders it
	// at once without asking ldb-api (a short link /c/... redirects here, and messengers follow it)
	const shared = $derived(
		(page.url.searchParams.get('urls') ?? '')
			.replace(/[\s,;-]+(?=https?:\/\/)/gi, ' ')
			.split(/\s+/)
			.filter((u) => /^https?:\/\//i.test(u))
	);
	const siteOf = (url: string) => {
		try {
			return new URL(url).hostname.replace(/^www\./, '');
		} catch {
			return '';
		}
	};
	const preview = $derived.by(() => {
		if (!shared.length)
			return { title: i18n.t('meta.title'), description: i18n.t('meta.description') };
		const sites = shared.map(siteOf).filter((h, i, all) => h && all.indexOf(h) === i);
		const more = sites.length > 3 ? i18n.t('og.more', { count: sites.length - 3 }) : '';
		const shown = shared.slice(0, 4).map((u) => u.replace(/^https?:\/\/(www\.)?/, ''));
		return {
			title: i18n.t('og.title', {
				count: shared.length,
				sites: sites.slice(0, 3).join(', ') + more
			}),
			description: `${shown.join(' · ')}${shared.length > 4 ? ' …' : ''} — ${i18n.t('og.open')}`
		};
	});

	const announcement = $derived(
		query.loading
			? query.rows.length
				? i18n.t('a11y.fetching', { count: query.rows.length })
				: ''
			: query.rows.length
				? i18n.t('a11y.done', { count: query.rows.length, failed: query.failed })
				: ''
	);

	// What the home page is, for search engines (schema.org WebApplication)
	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'WebApplication',
			name: 'urlhub',
			url: `${page.url.origin}/`,
			description: i18n.t('meta.description'),
			applicationCategory: 'UtilitiesApplication',
			operatingSystem: 'Any',
			browserRequirements: 'Requires JavaScript',
			inLanguage: ['pl', 'en'],
			isAccessibleForFree: true,
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' }
		}).replace(/</g, '\\u003c')
	);

	// The closing tag is split so that it does not end this component's own script
	const jsonLdTag = $derived(`<script type="application/ld+json">${jsonLd}</scr` + `ipt>`);

	// Only shared links (?urls=...) load by themselves; the examples wait for a click
	onMount(() => {
		recent.load();
		if (linksInAddress.trim()) fetchLinks();
		return () => query.stop();
	});
</script>

<svelte:head>
	<title>{shared.length ? `${preview.title} – urlhub` : i18n.t('meta.title')}</title>
	<meta name="description" content={preview.description} />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="urlhub" />
	<meta property="og:title" content={preview.title} />
	<meta property="og:description" content={preview.description} />
	<meta property="og:url" content={page.url.href} />
	<meta property="og:image" content={`${page.url.origin}/og.png`} />
	<meta property="og:image:width" content="1200" />
	<meta property="og:image:height" content="630" />
	<meta property="og:image:alt" content={i18n.t('og.imageAlt')} />
	<meta property="og:locale" content={i18n.lang === 'pl' ? 'pl_PL' : 'en_GB'} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={preview.title} />
	<meta name="twitter:description" content={preview.description} />
	<meta name="twitter:image" content={`${page.url.origin}/og.png`} />
	{#if shared.length}
		<!-- A set of someone's links: worth a preview in messengers, not a place in search results -->
		<meta name="robots" content="noindex, follow" />
	{:else}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD built here, "<" escaped -->
		{@html jsonLdTag}
	{/if}
</svelte:head>

{#if !shared.length}
	<SeoLinks path="/" />
{/if}

<main class="page shell">
	{#if query.rows.length}
		<a class="skip" href="#results">{i18n.t('a11y.skip')}</a>
	{/if}
	<UrlForm
		bind:text
		bind:advanced
		loading={query.loading}
		ready={query.ready}
		total={query.rows.length}
		error={query.error && queryError(i18n.t, query.error)}
		onsubmit={fetchLinks}
		onstop={() => query.stop()}
		onexample={tryExample}
		onadvanced={advancedChanged}
	>
		{#snippet actions()}
			<RecentMenu {recent} onopen={reopen} />
		{/snippet}
	</UrlForm>

	<!-- Said once when a query starts and once when it ends, not at every result -->
	<p class="sr-only" role="status">{announcement}</p>

	{#if query.rows.length}
		<section id="results" class="results" aria-labelledby="results-heading" tabindex="-1">
			<h2 id="results-heading" class="sr-only">{i18n.t('a11y.results')}</h2>
			<div class="toolbar">
				<div class="toolbar__row">
					<div class="toolbar__status">
						<p class="toolbar__summary">
							{summary}{#if query.failed}<span class="toolbar__failed"
									>{i18n.t('toolbar.failed', { count: query.failed })}</span
								>{/if}{#if query.blocked}<span class="toolbar__blocked"
									>{i18n.t('toolbar.blocked', { count: query.blocked })}</span
								>{/if}{filtered}
						</p>
						{#if query.failed && !query.loading}
							<button type="button" class="toolbar__retry" onclick={() => query.retryFailed()}
								>{i18n.t('toolbar.retryShort')}</button
							>
						{/if}
					</div>
					<div class="toolbar__views" role="group" aria-label={i18n.t('views.label')}>
						{#each VIEWS as v (v)}
							<button type="button" aria-pressed={view === v} onclick={() => show(v)}
								>{i18n.t(`views.${v}`)}</button
							>
						{/each}
					</div>
					<span class="toolbar__spacer"></span>
					<Menu label={i18n.t('toolbar.share')}>
						{#snippet children(close)}
							<button
								type="button"
								class="menu__item"
								onclick={() => {
									close();
									share();
								}}
								>{i18n.t('toolbar.copyLink')}<small>{i18n.t('toolbar.copyLinkHint')}</small></button
							>
							<button
								type="button"
								class="menu__item"
								disabled={query.loading}
								onclick={() => {
									close();
									shortLink();
								}}
								>{i18n.t('toolbar.shortLink')}<small>{i18n.t('toolbar.shortLinkHint')}</small
								></button
							>
						{/snippet}
					</Menu>
					<Menu label={i18n.t('toolbar.export')}>
						{#snippet children(close)}
							<button
								type="button"
								class="menu__item"
								onclick={() => {
									close();
									copyJson();
								}}>{i18n.t('toolbar.copyJson')}</button
							>
							<button
								type="button"
								class="menu__item"
								onclick={() => {
									close();
									downloadJson();
								}}>{i18n.t('toolbar.downloadJson')}</button
							>
							<button
								type="button"
								class="menu__item"
								onclick={() => {
									close();
									downloadCsv();
								}}>{i18n.t('toolbar.downloadCsv')}<small>{i18n.t('toolbar.csvHint')}</small></button
							>
						{/snippet}
					</Menu>
				</div>
				<div class="toolbar__row">
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
		</section>
	{:else if !query.loading}
		<ul class="features" aria-label={i18n.t('features.label')}>
			{#each ['tiles', 'share', 'seo'] as const as f (f)}
				<li><b>{i18n.t(`features.${f}.title`)}</b>{i18n.t(`features.${f}.text`)}</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding-block: 1.5rem 2.5rem;
	}

	.results {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.results:focus {
		outline: none;
	}

	/* Shown when reached with the keyboard: jumps over the form to the results */
	.skip {
		position: absolute;
		left: 1rem;
		top: -3rem;
		z-index: 40;
		padding: 0.5rem 0.75rem;
		color: var(--on-accent);
		background: var(--accent);
		border-radius: 0.4rem;
	}

	.skip:focus {
		top: 0.75rem;
	}

	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr));
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.features li {
		padding: 1rem;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--ink-3);
		background: var(--surface-2);
		border-radius: 0.75rem;
	}

	.features b {
		display: block;
		margin-bottom: 0.2rem;
		color: var(--ink);
	}

	.toolbar {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.toolbar__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
	}

	.toolbar__status {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.toolbar__summary {
		margin: 0;
		font-size: 0.85rem;
		font-weight: 600;
	}

	.toolbar__failed {
		color: var(--error);
	}

	.toolbar__blocked {
		font-weight: 400;
		color: var(--muted);
	}

	.toolbar__retry,
	.notice__undo {
		padding: 0;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink);
		text-decoration: underline;
		background: none;
		border: 0;
		cursor: pointer;
	}

	.toolbar__spacer {
		flex: 1;
	}

	.toolbar__views {
		display: inline-flex;
		padding: 0.2rem;
		background: var(--surface-3);
		border-radius: 0.6rem;
	}

	.toolbar__views button {
		min-height: 2rem;
		padding: 0.35rem 0.8rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--ink);
		background: transparent;
		border: 0;
		border-radius: 0.45rem;
		cursor: pointer;
	}

	.toolbar__views button[aria-pressed='true'] {
		background: var(--surface);
		box-shadow: 0 1px 3px var(--shadow);
	}

	.toolbar__filter {
		flex: 1 1 14rem;
		min-width: 0;
		min-height: 2.25rem;
		padding: 0.45rem 0.75rem;
		font: inherit;
		font-size: 0.85rem;
		color: var(--ink);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.6rem;
	}

	/* The browser's own arrow sits against the edge; this one keeps the same space as the text on the left */
	.toolbar__select {
		appearance: none;
		min-height: 2.25rem;
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

	.toolbar__views button:focus-visible,
	.toolbar__select:focus-visible,
	.toolbar__filter:focus-visible,
	.toolbar__retry:focus-visible,
	.notice__undo:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.notice {
		margin: 0;
		font-size: 0.8rem;
		color: var(--ink-3);
	}

	.notice__undo {
		margin-left: 0.5rem;
		font-size: 0.8rem;
	}
</style>
