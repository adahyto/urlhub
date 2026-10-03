<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SHOWN_FIRST, setKey, type FeaturedSet } from '$lib/featured';
	import { useI18n } from '$lib/i18n';

	const i18n = useI18n();

	interface Props {
		/** In the order to show them (lib/featured.ts) */
		sets: FeaturedSet[];
		/** The cards' pictures through /img, by setKey (signed on the server) */
		covers: Record<string, string[]>;
		/** Puts the set's links in the field and fetches them */
	}

	let { sets, covers }: Props = $props();

	/** A set is a page of its own (/s/<lang>/<id>), in the interface language chosen in the address */
	const hrefOf = (set: FeaturedSet) => {
		const lang = page.url.searchParams.get('lang');
		const path = resolve('/s/[lang]/[id]', { lang: set.lang, id: set.id });
		return lang ? `${path}?lang=${lang}` : path;
	};

	// A picture that does not load leaves its plain tile
	const hide = (event: Event) => ((event.currentTarget as HTMLElement).style.visibility = 'hidden');

	let all = $state(false);
	const shown = $derived(all ? sets : sets.slice(0, SHOWN_FIRST));
	const hidden = $derived(sets.length - SHOWN_FIRST);

	/** The sites of a set, as a card names them: the first few, then how many more */
	function sitesOf(set: FeaturedSet) {
		const sites = set.urls
			.map((url) => new URL(url).hostname.replace(/^www\./, ''))
			.filter((site, i, list) => list.indexOf(site) === i);
		const more = sites.length > 3 ? i18n.t('og.more', { count: sites.length - 3 }) : '';
		return sites.slice(0, 3).join(' · ') + more;
	}
</script>

{#if sets.length}
	<section class="featured" aria-labelledby="featured-heading">
		<h2 id="featured-heading" class="featured__heading">{i18n.t('featured.title')}</h2>
		<ul class="featured__list">
			{#each shown as set (set.id)}
				<li>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefOf uses resolve() -->
					<a class="card" href={hrefOf(set)}>
						{#if covers[setKey(set)]?.length}
							<!-- Pictures of the set's links: the text says what it is, so they are decoration -->
							<span
								class="card__covers"
								style:--covers={covers[setKey(set)].length}
								aria-hidden="true"
							>
								{#each covers[setKey(set)] as src (src)}
									<span class="card__cover">
										<img
											{src}
											alt=""
											width="240"
											height="240"
											loading="lazy"
											decoding="async"
											onerror={hide}
										/>
									</span>
								{/each}
							</span>
						{/if}
						<span class="card__title"
							>{set.title}{#if set.season}<span class="card__badge"
									>{i18n.t('featured.seasonal')}</span
								>{/if}</span
						>
						<span class="card__text">{set.description}</span>
						<span class="card__meta"
							>{i18n.t('form.links', { count: set.urls.length })} · {i18n.t(
								`views.${set.view}`
							)}</span
						>
						<span class="card__sites">{sitesOf(set)}</span>
					</a>
				</li>
			{/each}
		</ul>
		{#if hidden > 0}
			<button type="button" class="featured__more" aria-expanded={all} onclick={() => (all = !all)}
				>{all ? i18n.t('featured.less') : i18n.t('featured.more', { count: hidden })}</button
			>
		{/if}
	</section>
{/if}

<style>
	.featured {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.featured__heading {
		margin: 0;
		font-size: 1rem;
	}

	.featured__list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
		gap: 0.75rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.featured__list li {
		display: flex;
	}

	.card {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: 0.35rem;
		overflow: hidden;
		padding: 1rem;
		font: inherit;
		text-align: left;
		color: var(--ink);
		text-decoration: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		cursor: pointer;
	}

	.card:hover {
		border-color: var(--ink-3);
	}

	.card:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	/* Up to three square pictures in a row across the top of the card, edge to edge */
	.card__covers {
		display: grid;
		grid-template-columns: repeat(var(--covers, 3), 1fr);
		gap: 2px;
		margin: -1rem -1rem 0.5rem;
		background: var(--border-soft);
	}

	.card__cover {
		display: block;
		aspect-ratio: 1;
		overflow: hidden;
		background: var(--surface-3);
	}

	.card__cover img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.card__title {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 0.4rem;
		font-weight: 600;
	}

	.card__badge {
		padding: 0.05rem 0.4rem;
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--warning-ink);
		background: var(--warning-bg);
		border-radius: 0.3rem;
	}

	.card__text {
		flex: 1;
		font-size: 0.85rem;
		line-height: 1.45;
		color: var(--ink-3);
	}

	.card__meta,
	.card__sites {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.card__sites {
		overflow-wrap: anywhere;
	}

	.featured__more {
		align-self: flex-start;
		padding: 0.4rem 0.75rem;
		font: inherit;
		font-size: 0.85rem;
		color: var(--ink);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		cursor: pointer;
	}
</style>
