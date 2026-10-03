<script lang="ts">
	import { page } from '$app/state';
	import ListPage from '$lib/components/ListPage.svelte';
	import { proxied } from '$lib/images';
	import { PRIVACY } from '$lib/privacy';
	import { useI18n } from '$lib/i18n';
	import type { PageProps } from './$types';

	/* A published list (lib/server/lists.ts): its title, its links as they were when published, no way to change it */

	let { data }: PageProps = $props();
	const i18n = useI18n();

	const list = $derived(data.list);
	// What a messenger shows: the first picture of the list, or urlhub's own
	const picture = $derived(
		list.items.map((item) => proxied(item, item.ogImg?.ogImg)).find(Boolean) ?? ''
	);
	const report = $derived(
		`mailto:${PRIVACY.contactEmail}?subject=${encodeURIComponent(
			`${i18n.t('saved.reportSubject')} ${data.id}`
		)}&body=${encodeURIComponent(i18n.t('saved.reportBody', { url: page.url.href }))}`
	);
</script>

<ListPage
	title={list.title}
	description={list.description}
	urls={list.urls}
	rows={list.items}
	view={list.view}
	meta={i18n.t('saved.savedOn', {
		date: new Date(list.savedAt).toLocaleDateString(i18n.locale)
	})}
	image={new URL(picture || '/og.png', page.url.origin).href}
	name={`urlhub-${data.id}`}
	note={i18n.t('saved.fixed')}
	{report}
/>
