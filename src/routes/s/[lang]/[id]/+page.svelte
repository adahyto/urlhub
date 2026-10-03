<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import ListPage from '$lib/components/ListPage.svelte';
	import { FEATURED, setPath } from '$lib/featured';
	import { recent } from '$lib/history.svelte';
	import { LinkQuery, waiting } from '$lib/query.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageProps } from './$types';

	/*
	 * A featured set as a page, for people and search engines: its title, intro and links, with their details from
	 * the server when it had them (kept an hour), otherwise fetched here. It joins Recent like any query.
	 */

	let { data }: PageProps = $props();
	const i18n = useI18n();
	const query = new LinkQuery();

	const set = $derived(data.set);
	const rows = $derived(data.items ?? (query.rows.length ? query.rows : set.urls.map(waiting)));

	$effect(() => {
		const { urls, view } = set;
		const ready = data.items;
		untrack(() => {
			recent.load();
			if (ready) recent.add(urls, view, false);
			else query.run(urls.join('\n'), false, (found) => recent.add(found, view, false));
		});
		return () => query.stop();
	});

	const origin = $derived(page.url.origin);
	const canonical = $derived(`${origin}${setPath(set)}`);
	const other = $derived(
		set.alternate ? FEATURED.find((s) => s.lang !== set.lang && s.id === set.alternate) : undefined
	);
	const alternates = $derived([
		{ hreflang: set.lang, href: canonical },
		...(other ? [{ hreflang: other.lang, href: `${origin}${setPath(other)}` }] : [])
	]);
	const titleOf = (url: string) => rows.find((r) => r.url === url && r.title)?.title || url;
	// What the page is, for search engines: a collection of links, with the way back to the home page
	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: set.title,
			description: set.description,
			url: canonical,
			inLanguage: set.lang,
			isPartOf: { '@type': 'WebSite', name: 'urlhub', url: `${origin}/` },
			breadcrumb: {
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'urlhub', item: `${origin}/` },
					{ '@type': 'ListItem', position: 2, name: set.title, item: canonical }
				]
			},
			mainEntity: {
				'@type': 'ItemList',
				numberOfItems: set.urls.length,
				itemListElement: set.urls.map((url, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					url,
					name: titleOf(url)
				}))
			}
		}).replace(/</g, '\\u003c')
	);
</script>

<ListPage
	title={set.title}
	description={set.description}
	intro={set.intro}
	urls={set.urls}
	{rows}
	view={set.view}
	meta={i18n.t('featured.meta')}
	image={new URL(data.image || '/og.png', origin).href}
	name={`urlhub-${set.lang}-${set.id}`}
	note={i18n.t('featured.note')}
	robots="index, follow"
	{canonical}
	{alternates}
	{jsonLd}
/>
