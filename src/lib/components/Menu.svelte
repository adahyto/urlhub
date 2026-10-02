<script lang="ts">
	import { tick, type Snippet } from 'svelte';

	/*
	 * A button that opens a list of actions below it (the disclosure pattern): Escape or a click outside closes it
	 * and focus goes back to the button; ↑ ↓ move between the actions; choosing one closes the list.
	 */
	interface Props {
		label: string;
		/** Shown after the label, e.g. a count */
		badge?: string;
		disabled?: boolean;
		/** The list's content: buttons (class "menu__item") and anything else */
		children: Snippet<[close: () => void]>;
	}

	let { label, badge = '', disabled = false, children }: Props = $props();

	const id = `menu-${Math.random().toString(36).slice(2, 8)}`;
	let open = $state(false);
	let root = $state<HTMLElement>();
	let button = $state<HTMLButtonElement>();
	let list = $state<HTMLElement>();
	// The list hangs from the button's right edge; when that would put it off the left of the screen
	// (a button on the left of a phone screen), it hangs from the left edge instead
	let alignStart = $state(false);

	const items = () => [...(root?.querySelectorAll<HTMLElement>('.menu__list .menu__item') ?? [])];

	function close(focusButton = true) {
		open = false;
		if (focusButton) button?.focus();
	}

	async function toggle() {
		open = !open;
		if (open) {
			alignStart = false;
			await tick();
			if (list && list.getBoundingClientRect().left < 0) alignStart = true;
			items()[0]?.focus();
		}
	}

	function onkeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			close();
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		const list = items();
		const at = list.indexOf(document.activeElement as HTMLElement);
		const next = event.key === 'ArrowDown' ? at + 1 : at - 1;
		list[(next + list.length) % list.length]?.focus();
	}

	function onWindowClick(event: MouseEvent) {
		if (open && root && !root.contains(event.target as Node)) close(false);
	}
</script>

<svelte:window onclick={onWindowClick} />

<div class="menu" bind:this={root} {onkeydown} role="presentation">
	<button
		type="button"
		class="menu__button"
		aria-expanded={open}
		aria-controls={id}
		{disabled}
		bind:this={button}
		onclick={toggle}
	>
		{label}{#if badge}<span class="menu__badge">{badge}</span>{/if}
		<svg class="menu__chevron" viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4" /></svg>
	</button>
	{#if open}
		<div class="menu__list" class:menu__list--start={alignStart} {id} bind:this={list}>
			{@render children(() => close())}
		</div>
	{/if}
</div>

<style>
	.menu {
		position: relative;
	}

	.menu__button {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		min-height: 2.25rem;
		padding: 0.4rem 0.8rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--ink);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.6rem;
		cursor: pointer;
	}

	.menu__button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.menu__button:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.menu__badge {
		padding: 0 0.35rem;
		font-size: 0.7rem;
		background: var(--surface-3);
		border-radius: 0.3rem;
	}

	.menu__chevron {
		width: 0.6rem;
		height: 0.4rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.menu__list {
		position: absolute;
		top: calc(100% + 0.35rem);
		right: 0;
		z-index: 30;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		box-sizing: border-box;
		width: max-content;
		min-width: 15rem;
		max-width: min(22rem, calc(100vw - 2rem));
		padding: 0.35rem;
		color: var(--ink);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.7rem;
		box-shadow: 0 10px 24px var(--shadow);
	}

	.menu__list--start {
		right: auto;
		left: 0;
	}

	/* The actions inside: a block button each, with an optional line under it */
	.menu__list :global(.menu__item) {
		display: block;
		width: 100%;
		padding: 0.5rem 0.65rem;
		font: inherit;
		font-size: 0.85rem;
		text-align: left;
		color: var(--ink);
		background: none;
		border: 0;
		border-radius: 0.45rem;
		cursor: pointer;
	}

	.menu__list :global(.menu__item:hover),
	.menu__list :global(.menu__item:focus-visible) {
		background: var(--surface-3);
		outline: none;
	}

	.menu__list :global(.menu__item small) {
		display: block;
		margin-top: 0.15rem;
		font-size: 0.72rem;
		color: var(--muted);
	}

	@media (prefers-reduced-motion: no-preference) {
		.menu__list {
			animation: menu-drop 120ms ease-out;
		}
	}

	@keyframes menu-drop {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}
</style>
