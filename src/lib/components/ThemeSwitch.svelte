<script lang="ts">
	import { useI18n } from '$lib/i18n';

	/*
	 * Light or dark, over the system's setting. The choice is remembered on this device only once the visitor
	 * clicks: the click is the request, so no consent is needed (as for Recent). app.html applies it before the page
	 * shows, so a dark page does not flash light. Which icon shows is left to CSS, so it is right from the start.
	 */
	const i18n = useI18n();
	const KEY = 'urlhub.theme';

	function toggle() {
		const root = document.documentElement;
		const dark = root.dataset.theme
			? root.dataset.theme === 'dark'
			: matchMedia('(prefers-color-scheme: dark)').matches;
		const next = dark ? 'light' : 'dark';
		root.dataset.theme = next;
		try {
			localStorage.setItem(KEY, next);
		} catch {
			// Blocked: the choice lasts for this page only
		}
	}
</script>

<button
	type="button"
	class="theme"
	aria-label={i18n.t('header.theme')}
	title={i18n.t('header.theme')}
	onclick={toggle}
>
	<svg class="theme__moon" viewBox="0 0 24 24" aria-hidden="true"
		><path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" /></svg
	>
	<svg class="theme__sun" viewBox="0 0 24 24" aria-hidden="true"
		><circle cx="12" cy="12" r="4" /><path
			d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"
		/></svg
	>
</button>

<style>
	.theme {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		color: var(--ink-3);
		background: none;
		border: 0;
		border-radius: 0.4rem;
		cursor: pointer;
	}

	.theme:hover {
		color: var(--ink);
		background: var(--surface-3);
	}

	.theme:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* The moon on the light theme (to go dark), the sun on the dark one */
	.theme__sun {
		display: none;
	}

	@media (prefers-color-scheme: dark) {
		:global(:root:not([data-theme='light'])) .theme__sun {
			display: block;
		}

		:global(:root:not([data-theme='light'])) .theme__moon {
			display: none;
		}
	}

	:global(:root[data-theme='dark']) .theme__sun {
		display: block;
	}

	:global(:root[data-theme='dark']) .theme__moon {
		display: none;
	}
</style>
