<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { page } from '$app/state';
	import { LANGS, provideI18n, translator } from '$lib/i18n';
	import { COPYRIGHT_HOLDER } from '$lib/privacy';

	let { children, data } = $props();

	provideI18n(() => data.lang);
	const t = $derived(translator(data.lang));

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

	/** Other pages of the site, in the language chosen in the address (none chosen: the browser's) */
	const hrefTo = (path: string) =>
		page.url.searchParams.has('lang') ? `${path}?lang=${data.lang}` : path;

	// The home page's heading is the site's name; the other pages have their own
	const isHome = $derived(page.route.id === '/');
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Links within the site, with ?lang= when one was chosen: nothing to resolve -->
<!-- eslint-disable svelte/no-navigation-without-resolve -->
<header class="site-header">
	<div class="shell site-header__inner">
		<svelte:element this={isHome ? 'h1' : 'p'} class="site-header__brand">
			<a href={hrefTo('/')}>urlhub</a>
		</svelte:element>
		<p class="site-header__tagline">{t('header.tagline')}</p>
		<nav class="site-header__nav" aria-label={t('header.nav')}>
			<span class="lang">
				{#each LANGS as lang (lang)}
					<a
						href={hrefIn(lang)}
						hreflang={lang}
						{lang}
						aria-label={lang === 'pl' ? 'Polski' : 'English'}
						aria-current={data.lang === lang ? 'true' : undefined}
						data-sveltekit-noscroll
						data-sveltekit-replacestate>{lang.toUpperCase()}</a
					>
				{/each}
			</span>
		</nav>
	</div>
</header>

{@render children()}

<footer class="site-footer">
	<div class="shell site-footer__inner">
		<span
			>© {new Date().getFullYear()}
			<a href={COPYRIGHT_HOLDER.url} rel="external noopener">{COPYRIGHT_HOLDER.name}</a></span
		>
		<a href={hrefTo('/privacy')} aria-current={page.route.id === '/privacy' ? 'page' : undefined}
			>{t('footer.privacy')}</a
		>
	</div>
</footer>

<!-- eslint-enable svelte/no-navigation-without-resolve -->

<style>
	/* One column for header, page and footer: the same width and edges everywhere */
	:global(.shell) {
		box-sizing: border-box;
		width: 100%;
		max-width: 72rem;
		margin-inline: auto;
		padding-inline: 1.5rem;
	}

	@media (max-width: 40rem) {
		:global(.shell) {
			padding-inline: 1rem;
		}
	}

	:global(body) {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	.site-header {
		border-bottom: 1px solid var(--border-soft);
	}

	.site-header__inner {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.25rem 1rem;
		padding-block: 1rem;
	}

	.site-header__brand {
		margin: 0;
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.site-header__brand a {
		color: var(--ink);
		text-decoration: none;
	}

	.site-header__tagline {
		flex: 1 1 14rem;
		margin: 0;
		font-size: 0.85rem;
		color: var(--muted);
	}

	.site-header__nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.8rem;
	}

	.site-header__nav a,
	.site-footer a {
		color: var(--ink-3);
	}

	.lang {
		display: flex;
		gap: 0.15rem;
	}

	.lang a {
		padding: 0.15rem 0.35rem;
		font-weight: 600;
		color: var(--muted);
		text-decoration: none;
		border-radius: 0.3rem;
	}

	.lang a[aria-current='true'] {
		color: var(--ink);
		background: var(--surface-3);
	}

	.site-header a:focus-visible,
	.site-footer a:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.site-footer {
		margin-top: auto;
		border-top: 1px solid var(--border-soft);
	}

	.site-footer__inner {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1.25rem;
		padding-block: 1rem;
		font-size: 0.8rem;
		color: var(--muted);
	}
</style>
