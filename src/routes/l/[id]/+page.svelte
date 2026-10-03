<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Tiles from '$lib/components/Tiles.svelte';
	import ResultsTable from '$lib/components/ResultsTable.svelte';
	import Menu from '$lib/components/Menu.svelte';
	import { copyText, download } from '$lib/files';
	import { proxied } from '$lib/images';
	import { PRIVACY } from '$lib/privacy';
	import { asCsv, asJson } from '$lib/query.svelte';
	import { toTileUrl } from '$lib/tiles';
	import { useI18n } from '$lib/i18n';
	import type { PageProps } from './$types';

	/* A saved list (lib/server/lists.ts): its title, its links as they were when saved, and no way to change it */

	let { data }: PageProps = $props();
	const i18n = useI18n();

	const list = $derived(data.list);
	// The view it was saved with, until the visitor picks another
	let chosen = $state<'tiles' | 'table' | null>(null);
	const view = $derived(chosen ?? list.view);
	let notice = $state('');

	const sites = $derived(
		list.urls
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
			count: list.urls.length,
			sites:
				sites.slice(0, 3).join(', ') +
				(sites.length > 3 ? i18n.t('og.more', { count: sites.length - 3 }) : '')
		})
	);
	const description = $derived(list.description || summary);
	const savedOn = $derived(new Date(list.savedAt).toLocaleDateString(i18n.locale));
	// What a messenger shows: the first picture of the list, or urlhub's own
	const picture = $derived(
		list.items.map((item) => proxied(item, item.ogImg?.ogImg)).find(Boolean) ?? ''
	);
	const image = $derived(new URL(picture || '/og.png', page.url.origin).href);

	/** The links as an ordinary list on the home page, to change there; this one stays as it is */
	const copyHref = $derived.by(() => {
		const lang = page.url.searchParams.get('lang');
		const params = [
			['urls', list.urls.join(' ')],
			...(list.view === 'table' ? [['view', 'table']] : []),
			...(lang ? [['lang', lang]] : [])
		];
		return `${resolve('/')}?${new URLSearchParams(params)}`;
	});
	const report = $derived(
		`mailto:${PRIVACY.contactEmail}?subject=${encodeURIComponent(
			`${i18n.t('saved.reportSubject')} ${data.id}`
		)}&body=${encodeURIComponent(i18n.t('saved.reportBody', { url: page.url.href }))}`
	);

	let noticeTimer: ReturnType<typeof setTimeout> | undefined;
	async function copyLink() {
		await copyText(`${page.url.origin}${page.url.pathname}`);
		notice = i18n.t('saved.linkCopied');
		clearTimeout(noticeTimer);
		noticeTimer = setTimeout(() => (notice = ''), 2500);
	}

	const name = $derived(`urlhub-${data.id}`);

	// Phones offer their own sharing (messengers, mail); known only in the browser
	let canSend = $state(false);
	onMount(() => (canSend = typeof navigator.share === 'function'));
	async function send() {
		try {
			await navigator.share({ title: list.title, url: `${page.url.origin}${page.url.pathname}` });
		} catch {
			// cancelled
		}
	}
</script>

<svelte:head>
	<title>{list.title} – urlhub</title>
	<meta name="description" content={description} />
	<!-- Someone's list: worth a preview in messengers, not a place in search results -->
	<meta name="robots" content="noindex, follow" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="urlhub" />
	<meta property="og:title" content={list.title} />
	<meta property="og:description" content={description} />
	<meta property="og:url" content={`${page.url.origin}${page.url.pathname}`} />
	<meta property="og:image" content={image} />
	<meta property="og:locale" content={list.lang === 'pl' ? 'pl_PL' : 'en_GB'} />
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={list.title} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>

<!-- Links: the home page with a query (built with resolve) and a mailto: nothing more to resolve -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<main class="saved shell">
	<header class="saved__head">
		<h1 class="saved__title">{list.title}</h1>
		{#if list.description}
			<p class="saved__description">{list.description}</p>
		{/if}
		<p class="saved__meta">
			{i18n.t('form.links', { count: list.urls.length })} · {i18n.t('saved.savedOn', {
				date: savedOn
			})}
		</p>
	</header>

	<div class="toolbar">
		<div class="toolbar__views" role="group" aria-label={i18n.t('views.label')}>
			{#each ['tiles', 'table'] as const as v (v)}
				<button type="button" aria-pressed={view === v} onclick={() => (chosen = v)}
					>{i18n.t(`views.${v}`)}</button
				>
			{/each}
		</div>
		<span class="toolbar__spacer"></span>
		<button type="button" class="toolbar__button" onclick={copyLink}
			>{i18n.t('saved.copyLink')}</button
		>
		{#if canSend}
			<button type="button" class="toolbar__button" onclick={send}>{i18n.t('saved.send')}</button>
		{/if}
		<Menu label={i18n.t('toolbar.export')}>
			{#snippet children(close)}
				<button
					type="button"
					class="menu__item"
					onclick={() => {
						close();
						download(asJson(list.items), 'application/json', `${name}.json`);
					}}>{i18n.t('toolbar.downloadJson')}</button
				>
				<button
					type="button"
					class="menu__item"
					onclick={() => {
						close();
						download(asCsv(list.items), 'text/csv;charset=utf-8', `${name}.csv`);
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
		{#if view === 'tiles'}
			<Tiles urls={list.items.map(toTileUrl)} />
		{:else}
			<ResultsTable rows={list.items} advanced={false} />
		{/if}
	</section>

	<footer class="saved__foot">
		<p>{i18n.t('saved.fixed')}</p>
		<p><a href={report}>{i18n.t('saved.report')}</a></p>
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
