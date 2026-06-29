<script lang="ts">
	interface URL {
		url: string;
		title: string;
		desc: string;
		ogImg: {
			src: string;
			alt: string;
		};
	}
	let { urls }: { urls: URL[] } = $props();

	// Which tile currently has its description revealed (touch devices)
	let activeUrl = $state<string | null>(null);

	function toggle(url: string) {
		activeUrl = activeUrl === url ? null : url;
	}
</script>

<ul class="tiles" role="list">
	{#each urls as item (item.url)}
		<li class="tiles__item" class:is-active={activeUrl === item.url}>
			<a class="tiles__link" href={item.url} target="_blank">
				<img
					class="tiles__image"
					src={item.ogImg.src}
					alt={item.ogImg.alt}
					loading="lazy"
					decoding="async"
					draggable="false"
				/>
				<span class="tiles__title">{item.title}</span>
				<span class="tiles__desc">
					<span class="tiles__desc-title">{item.title}</span>
					<span class="tiles__desc-text">{item.desc}</span>
				</span>
			</a>

			<button
				type="button"
				class="tiles__info"
				aria-label={activeUrl === item.url ? 'Hide description' : 'Show description'}
				aria-expanded={activeUrl === item.url}
				onclick={() => toggle(item.url)}
			>
				{#if activeUrl === item.url}
					<!-- close icon -->
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				{:else}
					<!-- info icon -->
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<circle cx="12" cy="12" r="9" />
						<line x1="12" y1="11" x2="12" y2="16" />
						<circle cx="12" cy="7.5" r="0.5" />
					</svg>
				{/if}
			</button>
		</li>
	{/each}
</ul>

<style>
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
		gap: 0.5rem;
		padding: 0;
		list-style: none;
	}

	.tiles__item {
		position: relative;
		margin: 0;
	}

	.tiles__link {
		display: block;
		position: relative;
		aspect-ratio: 1;
		overflow: hidden;
		background: #f0f0f0;
	}

	.tiles__image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition:
			transform 350ms ease,
			filter 350ms ease;
	}

	.tiles__title {
		position: absolute;
		inset: auto 0 0 0;
		padding: 2.5rem 1.5rem 1.5rem;
		color: #fff;
		font-size: 0.75rem;
		font-weight: 200;
		line-height: 1.25;
		background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
		pointer-events: none;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
		z-index: 2;
		font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
		text-transform: uppercase;
		transition: opacity 350ms ease;
	}

	.tiles__desc {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: flex-start;   /* left */
		justify-content: flex-start; /* top */
		padding: 1.5rem;
		color: #fff;
		font-size: 0.85rem;
		font-weight: 300;
		line-height: 1.5;
		text-align: left;          /* left-aligned text */
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
		font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
		opacity: 0;
		z-index: 3;
		pointer-events: none;
		overflow: hidden;
		transition: opacity 350ms ease;
	}

	.tiles__desc-title {
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.25;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 0.5rem;
	}

	.tiles__desc-text {
		font-size: 0.85rem;
		font-weight: 300;
		line-height: 1.5;
	}
	
	/* ── Info / close toggle button (touch only) ── */
	.tiles__info {
		display: none; /* hidden by default; shown on touch devices below */
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 4;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		align-items: center;
		justify-content: center;
		color: #fff;
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(4px);
		border: 1px solid rgba(255, 255, 255, 0.3);
		border-radius: 50%;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
		transition: background 200ms ease;
	}

	.tiles__info svg {
		width: 1.1rem;
		height: 1.1rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.tiles__info:active {
		background: rgba(0, 0, 0, 0.65);
	}

	.tiles__link:focus-visible,
	.tiles__info:focus-visible {
		outline: 3px solid #1a1a1a;
		outline-offset: 3px;
	}

	/* ── Active state (set by the button on touch) ── */
	.tiles__item.is-active .tiles__image {
		transform: scale(1.05);
		filter: blur(6px) brightness(0.4);
	}
	.tiles__item.is-active .tiles__title {
		opacity: 0;
	}
	.tiles__item.is-active .tiles__desc {
		opacity: 1;
	}

	/* ── Desktop / pointer devices: hover reveals description ── */
	@media (hover: hover) and (pointer: fine) {
		.tiles__link:hover .tiles__image,
		.tiles__link:focus-visible .tiles__image {
			transform: scale(1.05);
			filter: blur(6px) brightness(0.4);
		}
		.tiles__link:hover .tiles__title,
		.tiles__link:focus-visible .tiles__title {
			opacity: 0;
		}
		.tiles__link:hover .tiles__desc,
		.tiles__link:focus-visible .tiles__desc {
			opacity: 1;
		}
	}

	/* ── Touch devices (mobile/tablet): show the info button ── */
	@media (hover: none) {
		.tiles__info {
			display: inline-flex;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.tiles__image {
			transition: filter 200ms ease;
		}
		.tiles__link:hover .tiles__image,
		.tiles__link:focus-visible .tiles__image,
		.tiles__item.is-active .tiles__image {
			transform: none;
		}
	}

	@media (max-width: 48rem) {
		.tiles__title {
			font-size: 1.75rem;
		}
		.tiles__link {
			width: 100%;
			height: 220px;
		}
	}
</style>