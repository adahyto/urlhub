<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { LANGS, provideI18n } from '$lib/i18n';

	let { children, data } = $props();

	provideI18n(() => data.lang);

	// The server sets <html lang>; switching on the page changes it here
	$effect(() => {
		document.documentElement.lang = data.lang;
	});

	/** The same page and results in another language */
	const hrefIn = (lang: string) => {
		const url = new URL(page.url);
		url.searchParams.set('lang', lang);
		return `${url.pathname}${url.search}`;
	};
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<nav class="lang" aria-label="Language / Język">
	<!-- The current page with another ?lang=: nothing to resolve -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	{#each LANGS as lang (lang)}
		<a
			href={hrefIn(lang)}
			hreflang={lang}
			{lang}
			aria-current={data.lang === lang ? 'true' : undefined}
			data-sveltekit-noscroll
			data-sveltekit-replacestate>{lang.toUpperCase()}</a
		>
	{/each}
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</nav>

{@render children()}

<style>
	.lang {
		position: absolute;
		top: 0.75rem;
		right: 1rem;
		z-index: 10;
		display: flex;
		gap: 0.25rem;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.lang a {
		padding: 0.2rem 0.4rem;
		color: var(--muted);
		text-decoration: none;
		border-radius: 0.35rem;
	}

	.lang a[aria-current='true'] {
		color: var(--ink);
		background: var(--surface-3);
	}

	.lang a:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>
