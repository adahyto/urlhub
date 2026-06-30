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

	let activeUrl = $state<string | null>(null);

	function toggle(url: string) {
		activeUrl = activeUrl === url ? null : url;
	}

	const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i;
	const VIDEO_RE = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?.*)?$/i;

	type Category = 'img' | 'video' | 'other';

	type TileView = {
		kind: 'image' | 'video' | 'og';
		category: Category;
		src: string;
		alt: string;
		title: string;
		desc: string;
	};

	const toHttps = (u: string) => u.replace(/^http:\/\//i, 'https://');

	function tileView(item: URL): TileView {
		const fromUrl = {
			title: item.url.slice(0, 18),
			desc: item.url
		};

		if (VIDEO_RE.test(item.url)) {
			return {
				kind: 'video',
				category: 'video',
				src: `${toHttps(item.url)}#t=0.1`,
				alt: 'video',
				...fromUrl
			};
		}

		if (IMAGE_RE.test(item.url)) {
			return {
				kind: 'image',
				category: 'img',
				src: toHttps(item.url),
				alt: 'img',
				...fromUrl
			};
		}

		if (!item.ogImg?.src) {
			return {
				kind: 'image',
				category: 'other',
				src: toHttps(item.url),
				alt: 'other',
				...fromUrl
			};
		}

		return {
			kind: 'og',
			category: 'other',
			src: item.ogImg.src || toHttps(item.url),
			alt: item.ogImg.alt || 'other',
			title: item.title,
			desc: item.desc
		};
	}
</script>
<ul class="tiles" role="list">
	{#each urls as item (item.url)}
		{@const view = tileView(item)}
		<li class="tiles__item" class:is-active={activeUrl === item.url}>
			<a class="tiles__link" href={item.url} target="_blank" rel="noopener">
				{#if view.kind === 'video'}
	<video
		class="tiles__image"
		src={view.src}
		muted
		loop
		autoplay
		playsinline
		preload="metadata"
		aria-label={view.alt}
		onerror={(e) => ((e.currentTarget as HTMLVideoElement).style.opacity = '0.15')}
	></video>
				{:else}
					<img
						class="tiles__image"
						src={view.src}
						alt={view.alt}
						loading="lazy"
						decoding="async"
						draggable="false"
						referrerpolicy="no-referrer"
						onerror={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.15')}
					/>
				{/if}

				<span class="tiles__title">{view.title}</span>
				<span class="tiles__desc">
					<span class="tiles__desc-title">{view.title}</span>
					<span class="tiles__desc-text">{view.desc}</span>
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
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M6 6l12 12M18 6L6 18" />
					</svg>
				{:else}
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
			filter 350ms ease,
			opacity 350ms ease;
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
		align-items: flex-start;
		justify-content: flex-start;
		padding: 1.5rem;
		color: #fff;
		text-align: left;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
		font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
		opacity: 0;
		z-index: 3;
		pointer-events: none;
		overflow: hidden;
		transition: opacity 350ms ease;
		width: 80%;
	}

	.tiles__desc-title {
		font-size: 0.95rem;
		font-weight: 600;
		line-height: 1.25;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		margin-bottom: 0.5rem;
		overflow-wrap: anywhere;
	}

	.tiles__desc-text {
		font-size: 0.85rem;
		font-weight: 300;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}

	.tiles__info {
		display: none;
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