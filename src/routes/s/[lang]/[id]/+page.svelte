<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import ListPage from '$lib/components/ListPage.svelte';
	import { recent } from '$lib/history.svelte';
	import { LinkQuery, waiting } from '$lib/query.svelte';
	import { useI18n } from '$lib/i18n';
	import type { PageProps } from './$types';

	/*
	 * A featured set as a page: its title and description at once, its links' details fetched now (ldb-api keeps
	 * them for 30 minutes), so the set always shows the pages as they are. It joins Recent like any query.
	 */

	let { data }: PageProps = $props();
	const i18n = useI18n();
	const query = new LinkQuery();

	const set = $derived(data.set);
	const rows = $derived(query.rows.length ? query.rows : set.urls.map(waiting));

	$effect(() => {
		const { urls, view } = set;
		untrack(() => {
			recent.load();
			query.run(urls.join('\n'), false, (found) => recent.add(found, view, false));
		});
		return () => query.stop();
	});
</script>

<ListPage
	title={set.title}
	description={set.description}
	urls={set.urls}
	{rows}
	view={set.view}
	meta={i18n.t('featured.meta')}
	image={new URL(data.image || '/og.png', page.url.origin).href}
	name={`urlhub-${set.lang}-${set.id}`}
	note={i18n.t('featured.note')}
/>
