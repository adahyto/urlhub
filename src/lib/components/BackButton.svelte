<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { useI18n } from '$lib/i18n';

	/*
	 * Back, for urlhub opened from the home screen (display: standalone, see static/manifest.webmanifest): such an
	 * app has no browser bar, so no back button of its own. Shown only there (CSS), and not on the home page. It goes
	 * back where the visitor came from in urlhub; a page opened straight from a link goes to the home page instead.
	 */
	const i18n = useI18n();

	function back() {
		const fromHere = document.referrer.startsWith(location.origin) && history.length > 1;
		if (fromHere) history.back();
		else {
			const lang = page.url.searchParams.get('lang');
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve('/') with ?lang=
			goto(lang ? `${resolve('/')}?lang=${lang}` : resolve('/'));
		}
	}
</script>

<button type="button" class="back" aria-label={i18n.t('header.back')} onclick={back}>
	<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
</button>

<style>
	.back {
		display: none;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		margin: 0 0.15rem 0 -0.5rem;
		padding: 0;
		color: var(--ink);
		background: none;
		border: 0;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	.back:hover {
		background: var(--surface-3);
	}

	.back:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	svg {
		width: 1.25rem;
		height: 1.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* Only as an app from the home screen (iOS also says so with navigator.standalone, set in the layout) */
	@media (display-mode: standalone) {
		.back {
			display: inline-flex;
		}
	}

	:global(html.is-standalone) .back {
		display: inline-flex;
	}
</style>
