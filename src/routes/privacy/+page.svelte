<script lang="ts">
	import { useI18n, type Key } from '$lib/i18n';
	import { PRIVACY } from '$lib/privacy';
	import SeoLinks from '$lib/components/SeoLinks.svelte';

	/* What data urlhub handles (GDPR art. 13 information), on the pattern of kosmos.info.pl's privacy page */
	const i18n = useI18n();

	const SECTIONS = [
		'controller',
		'links',
		'pictures',
		'address',
		'storage',
		'logs',
		'where',
		'rights'
	] as const;

	const params = $derived({
		controller: PRIVACY.controller,
		email: PRIVACY.contactEmail,
		authority: PRIVACY.authority[i18n.lang]
	});
	const updated = $derived(
		new Date(PRIVACY.updated).toLocaleDateString(i18n.locale, {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		})
	);
</script>

<svelte:head>
	<title>{i18n.t('privacy.title')} – urlhub</title>
	<meta name="description" content={i18n.t('privacy.intro')} />
</svelte:head>

<SeoLinks path="/privacy" />

<main class="privacy shell" aria-labelledby="privacy-heading">
	<h1 id="privacy-heading">{i18n.t('privacy.title')}</h1>
	<p class="privacy__intro">{i18n.t('privacy.intro')}</p>
	{#each SECTIONS as section (section)}
		<section>
			<h2>{i18n.t(`privacy.${section}.title` as Key)}</h2>
			<p>{i18n.t(`privacy.${section}.text` as Key, params)}</p>
		</section>
	{/each}
	<p class="privacy__updated">
		<time datetime={PRIVACY.updated}>{i18n.t('privacy.updated', { date: updated })}</time>
	</p>
</main>

<style>
	.privacy {
		padding-block: 2rem 3rem;
		line-height: 1.6;
	}

	.privacy > :global(*) {
		max-width: 48rem;
	}

	h1 {
		margin: 0;
		font-size: 2rem;
		line-height: 1.15;
	}

	.privacy__intro {
		margin: 0.75rem 0 0;
		font-size: 1.05rem;
		color: var(--ink-2);
	}

	section {
		margin-top: 2rem;
	}

	h2 {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
	}

	section p {
		margin: 0;
		color: var(--ink-2);
	}

	.privacy__updated {
		margin: 2.5rem 0 0;
		font-size: 0.85rem;
		color: var(--muted);
	}
</style>
