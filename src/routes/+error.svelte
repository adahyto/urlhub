<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { useI18n } from '$lib/i18n';

	const i18n = useI18n();
	const missing = $derived(page.error?.message === 'short-link-missing');
</script>

<svelte:head>
	<title>urlhub – {page.status}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="error shell">
	<h1>{missing ? i18n.t('errorPage.shortLinkTitle') : page.status}</h1>
	<p>{missing ? i18n.t('errorPage.shortLinkText') : i18n.t('errorPage.other')}</p>
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
