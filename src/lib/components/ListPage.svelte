<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Tiles from './Tiles.svelte';
	import ResultsTable from './ResultsTable.svelte';
	import Menu from './Menu.svelte';
	import { copyText, download } from '$lib/files';
	import { asCsv, asJson } from '$lib/query.svelte';
	import { toTileUrl } from '$lib/tiles';
	import { useI18n } from '$lib/i18n';
	import type { Row } from '$lib/types';

	/*
	 * A list shown as a page of its own, to look at and share, with no form: a published list (/l/<id>) and a
	 * featured set (/s/<lang>/<id>). Its title is the heading; "Edit a copy" opens its links on the home page.
	 */

	interface Props {
		title: string;
		description: string;
		urls: string[];
		/** Their details; pending ones fill in as they come */
		rows: Row[];
		/** The view it opens in */
		view: 'tiles' | 'table';
		/** The line under the description, after the number of links */
		meta: string;
		/** For messengers: an absolute address */
		image: string;
		/** Downloads are named after it */
		name: string;
		/** The note at the bottom */
		note: string;
		/** A mailto: to report the page, if it is someone's */
		report?: string;
		/** A few sentences under the heading */
		intro?: string;
		/** Someone's list stays out of search results; a featured set is meant to be found */
		robots?: string;
		/** For search engines: the page's own address, and its versions in other languages */
		canonical?: string;
		alternates?: { hreflang: string; href: string }[];
		/** schema.org JSON-LD, "<" already escaped */
		jsonLd?: string;
		/** Where the page sits: links above the heading, the page itself last (not a link) */
		crumbs?: { name: string; href: string }[];
	}

	let {
		title,
		description,
		urls,
		rows,
		view,
		meta,
		image,
		name,
		note,
		report,
		intro,
		robots = 'noindex, follow',
		canonical,
		alternates = [],
		jsonLd,
		crumbs = []
	}: Props = $props();
	// The closing tag is split so that it does not end this component's own script
	const jsonLdTag = $derived(
		jsonLd ? `<script type="application/ld+json">${jsonLd}</scr` + `ipt>` : ''
	);
	const i18n = useI18n();

	// The view it opens in, until the visitor picks another
	let chosen = $state<'tiles' | 'table' | null>(null);
	const shown = $derived(chosen ?? view);
	let notice = $state('');

	const sites = $derived(
		urls
			.map((u) => {
				try {
					return new URL(u).hostname.replace(/^www\./, '');
				} catch {
					return '';
				}
			})
			.filter((h, i, all) => h && all.indexOf(h) === i)
	);
	const summary = $derived(
		i18n.t('og.title', {
			count: urls.length,
			sites:
				sites.slice(0, 3).join(', ') +
				(sites.length > 3 ? i18n.t('og.more', { count: sites.length - 3 }) : '')
		})
	);
	const about = $derived(description || summary);
	const address = $derived(`${page.url.origin}${page.url.pathname}`);

	/** The links as an ordinary list on the home page, to change there; this one stays as it is */
	const copyHref = $derived.by(() => {
		const lang = page.url.searchParams.get('lang');
		const params = [
			['urls', urls.join(' ')],
			...(view === 'table' ? [['view', 'table']] : []),
			...(lang ? [['lang', lang]] : [])
		];
		return `${resolve('/')}?${new URLSearchParams(params)}`;
	});

	let noticeTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * One button: the system's own sharing where there is one (phones, some browsers: messengers, mail, ...),
	 * otherwise the link is copied. Closing the share sheet is not a failure; a sheet that cannot open copies.
	 */
	async function share() {
		if (typeof navigator.share === 'function') {
			try {
				await navigator.share({ title, url: address });
				return;
			} catch (err) {
				if ((err as Error).name === 'AbortError') return;
			}
		}
		await copyText(address);
		notice = i18n.t('saved.linkCopied');
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 2500);
	}
</script>

<svelte:head>
	<title>{title} – urlhub</title>
	<meta name="description" content={about} />
	<meta name="robots" content={robots} />
	{#if canonical}
		<link rel="canonical" href={canonical} />
	{/if}
	{#each alternates as a (a.hreflang)}
		<link rel="alternate" hreflang={a.hreflang} href={a.href} />
	{/each}
	{#if jsonLdTag}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD built by the page, "<" escaped -->
		{@html jsonLdTag}
	{/if}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="urlhub" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={about} />
	<meta property="og:url" content={canonical ?? address} />
	<meta property="og:image" content={image} />
	<meta property="og:locale" content={i18n.lang === 'pl' ? 'pl_PL' : 'en_GB'} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={about} />
	<meta name="twitter:image" content={image} />
</svelte:head>

<!-- Links: the home page with a query (built with resolve) and a mailto: nothing more to resolve -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<main class="saved shell">
	<header class="saved__head">
		{#if crumbs.length}
			<nav class="saved__crumbs" aria-label={i18n.t('featured.crumbs')}>
				<ol>
					{#each crumbs as crumb (crumb.href)}
						<li><a href={crumb.href}>{crumb.name}</a></li>
					{/each}
					<li aria-current="page">{title}</li>
				</ol>
			</nav>
		{/if}
		<h1 class="saved__title">{title}</h1>
		{#if description}
			<p class="saved__description">{description}</p>
		{/if}
		<p class="saved__meta">{i18n.t('form.links', { count: urls.length })} · {meta}</p>
		{#if intro}
			<p class="saved__intro">{intro}</p>
		{/if}
	</header>

	<div class="toolbar">
		<div class="toolbar__views" role="group" aria-label={i18n.t('views.label')}>
			{#each ['tiles', 'table'] as const as v (v)}
				<button type="button" aria-pressed={shown === v} onclick={() => (chosen = v)}
					>{i18n.t(`views.${v}`)}</button
				>
			{/each}
		</div>
		<span class="toolbar__spacer"></span>
		<button type="button" class="toolbar__button" onclick={share}>{i18n.t('saved.share')}</button>
		<Menu label={i18n.t('toolbar.export')}>
			{#snippet children(close)}
				<button
					type="button"
					class="menu__item"
					onclick={() => {
						close();
						download(asJson(rows), 'application/json', `${name}.json`);
					}}>{i18n.t('toolbar.downloadJson')}</button
				>
				<button
					type="button"
					class="menu__item"
					onclick={() => {
						close();
						download(asCsv(rows), 'text/csv;charset=utf-8', `${name}.csv`);
					}}>{i18n.t('toolbar.downloadCsv')}<small>{i18n.t('toolbar.csvHint')}</small></button
				>
			{/snippet}
		</Menu>
		<a class="toolbar__button toolbar__button--primary" href={copyHref}
			>{i18n.t('saved.editCopy')}</a
		>
	</div>

	{#if notice}
		<p class="notice" role="status">{notice}</p>
	{/if}

	<section aria-label={i18n.t('a11y.results')}>
		{#if shown === 'tiles'}
			<Tiles urls={rows.map(toTileUrl)} />
		{:else}
			<ResultsTable {rows} advanced={false} />
		{/if}
	</section>

	<footer class="saved__foot">
		<p>{note}</p>
		{#if report}
			<p><a href={report}>{i18n.t('saved.report')}</a></p>
		{/if}
	</footer>
</main>

<style>
	.saved {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		padding-block: 1.5rem 2.5rem;
	}

	.saved__head {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.saved__title {
		margin: 0;
		font-size: clamp(1.5rem, 4vw, 2.1rem);
		line-height: 1.2;
		overflow-wrap: anywhere;
	}

	.saved__description {
		margin: 0;
		max-width: 60ch;
		color: var(--ink-2);
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	.saved__crumbs ol {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		font-size: 0.8rem;
		color: var(--muted);
		list-style: none;
	}

	.saved__crumbs li + li::before {
		content: '›';
		margin-right: 0.25rem;
	}

	.saved__crumbs a {
		color: inherit;
	}

	.saved__intro {
		margin: 0.4rem 0 0;
		max-width: 70ch;
		line-height: 1.6;
		color: var(--ink-2);
	}

	.saved__meta {
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
	}

	.toolbar__views {
		display: flex;
		gap: 0.15rem;
		padding: 0.2rem;
		background: var(--surface-3);
		border-radius: 0.5rem;
	}

	.toolbar__views button {
		min-height: 2.25rem;
		padding: 0.35rem 0.75rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink-2);
		background: none;
		border: 0;
		border-radius: 0.35rem;
		cursor: pointer;
	}

	.toolbar__views button[aria-pressed='true'] {
		color: var(--ink);
		background: var(--surface);
		box-shadow: 0 1px 2px var(--shadow);
	}

	.toolbar__spacer {
		flex: 1;
	}

	.toolbar__button {
		display: inline-flex;
		align-items: center;
		min-height: 2.25rem;
		padding: 0.35rem 0.85rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink);
		text-decoration: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		cursor: pointer;
	}

	.toolbar__button--primary {
		color: var(--on-accent);
		background: var(--accent);
		border-color: var(--accent);
	}

	.notice {
		margin: 0;
		font-size: 0.85rem;
		color: var(--success);
	}

	.saved__foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem 1rem;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.saved__foot p {
		margin: 0;
	}

	.saved__foot a {
		color: inherit;
	}
</style>
