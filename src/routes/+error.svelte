<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useI18n } from '$lib/i18n';

	const i18n = useI18n();
	const missing = $derived(page.error?.message === 'short-link-missing');
	const listMissing = $derived(page.error?.message === 'saved-list-missing');
</script>

<svelte:head>
	<title>urlhub – {page.status}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="error shell">
	{#if missing}
		<h1>{i18n.t('errorPage.shortLinkTitle')}</h1>
		<p>{i18n.t('errorPage.shortLinkText')}</p>
	{:else if listMissing}
		<h1>{i18n.t('errorPage.savedListTitle')}</h1>
		<p>{i18n.t('errorPage.savedListText')}</p>
	{:else}
		<h1>{page.status}</h1>
		<p>{i18n.t('errorPage.other')}</p>
	{/if}
	<p><a href={resolve('/')}>← urlhub</a></p>
</main>

<style>
	.error {
		padding-block: 3rem;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	.error a {
		color: inherit;
	}
</style>
