<script lang="ts">
	import { page } from '$app/state';
	import FeaturedSets from '$lib/components/FeaturedSets.svelte';
	import { featuredFor, outOfSeason, setPath } from '$lib/featured';
	import { LANGS } from '$lib/i18n/lang';
	import { useI18n } from '$lib/i18n';
	import type { PageProps } from './$types';

	/* Every featured set of a language, so each one is a link away (people and search engines alike) */

	let { data }: PageProps = $props();
	const i18n = useI18n();

	const now = $derived(featuredFor(data.lang, data.today));
	const archive = $derived(outOfSeason(data.lang, data.today));
	const origin = $derived(page.url.origin);
	const canonical = $derived(`${origin}/s/${data.lang}`);
	const jsonLd = $derived(
		JSON.stringify({
			'@context': 'https://schema.org',
			'@type': 'CollectionPage',
			name: i18n.t('featured.indexTitle'),
			description: i18n.t('featured.lead'),
			url: canonical,
			inLanguage: data.lang,
			isPartOf: { '@type': 'WebSite', name: 'urlhub', url: `${origin}/` },
			mainEntity: {
				'@type': 'ItemList',
				numberOfItems: now.length + archive.length,
				itemListElement: [...now, ...archive].map((set, i) => ({
					'@type': 'ListItem',
					position: i + 1,
					url: `${origin}${setPath(set)}`,
					name: set.title
				}))
			}
		}).replace(/</g, '\\u003c')
	);
	const jsonLdTag = $derived(`<script type="application/ld+json">${jsonLd}</scr` + `ipt>`);
</script>

<svelte:head>
	<title>{i18n.t('featured.indexTitle')} – urlhub</title>
	<meta name="description" content={i18n.t('featured.lead')} />
	<link rel="canonical" href={canonical} />
	{#each LANGS as lang (lang)}
		<link rel="alternate" hreflang={lang} href={`${origin}/s/${lang}`} />
	{/each}
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="urlhub" />
	<meta property="og:title" content={i18n.t('featured.indexTitle')} />
	<meta property="og:description" content={i18n.t('featured.lead')} />
	<meta property="og:url" content={canonical} />
	<meta property="og:image" content={`${origin}/og.png`} />
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD built here, "<" escaped -->
	{@html jsonLdTag}
</svelte:head>

<main class="sets shell">
	<header class="sets__head">
		<h1 class="sets__title">{i18n.t('featured.indexTitle')}</h1>
		<p class="sets__lead">{i18n.t('featured.lead')}</p>
	</header>
	<FeaturedSets
		sets={now}
		covers={data.covers}
		heading={i18n.t('featured.now')}
		limit={Infinity}
		id="sets-now"
	/>
	<FeaturedSets
		sets={archive}
		covers={data.covers}
		heading={i18n.t('featured.archive')}
		lead={i18n.t('featured.archiveLead')}
		limit={Infinity}
		id="sets-archive"
	/>
</main>

<style>
	.sets {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		padding-block: 1.5rem 2.5rem;
	}

	.sets__head {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.sets__title {
		margin: 0;
		font-size: clamp(1.5rem, 4vw, 2.1rem);
		line-height: 1.2;
	}

	.sets__lead {
		margin: 0;
		max-width: 70ch;
		line-height: 1.6;
		color: var(--ink-2);
	}
</style>
