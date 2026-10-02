<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import RowDetails from './RowDetails.svelte';
	import type { Row } from '$lib/types';

	let { rows, advanced }: { rows: Row[]; advanced: boolean } = $props();

	const hostOf = (u: string) => {
		try {
			return new URL(u).hostname.replace(/^www\./, '');
		} catch {
			return u;
		}
	};

	const date = (iso?: string) => {
		const time = Date.parse(iso ?? '');
		return Number.isNaN(time) ? '' : new Date(time).toLocaleDateString();
	};

	const number = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

	/** Site, author, date, stars: whatever the link has, in one short line */
	const metaOf = (item: Row) =>
		[
			item.author || item.channel,
			date(item.published),
			item.extra?.stars !== undefined ? `★ ${number.format(item.extra.stars)}` : '',
			item.extra?.language
		].filter(Boolean);

	// A picture that does not load keeps its place in the column; an icon that does not load goes away
	const hide = (event: Event) => ((event.currentTarget as HTMLElement).style.visibility = 'hidden');
	const drop = (event: Event) => ((event.currentTarget as HTMLElement).style.display = 'none');

	// The worst level among a page's warnings colours its badge
	const RANK = { error: 3, warning: 2, info: 1 } as const;
	const worst = (item: Row) =>
		(item.warnings ?? []).reduce<'error' | 'warning' | 'info' | null>(
			(max, w) => (!max || RANK[w.level] > RANK[max] ? w.level : max),
			null
		);

	// Columns sort on click: ascending, descending, then back to the order of the list
	type SortKey = 'title' | 'type' | 'duration' | 'warnings';
	let sortKey = $state<SortKey | null>(null);
	let descending = $state(false);

	const seconds = (hms?: string) =>
		(hms ?? '').split(':').reduce((total, part) => total * 60 + (Number(part) || 0), 0);
	const KEYS: Record<SortKey, (r: Row) => string | number> = {
		title: (r) => (r.title || r.url).toLowerCase(),
		type: (r) => `${r.type} ${r.service ?? ''}`,
		duration: (r) => seconds(r.duration),
		warnings: (r) =>
			(r.error ? 1000 : 0) + (r.warnings ?? []).reduce((sum, w) => sum + RANK[w.level], 0)
	};

	const sorted = $derived.by(() => {
		if (!sortKey) return rows;
		const key = KEYS[sortKey];
		const sign = descending ? -1 : 1;
		return [...rows].sort((a, b) => {
			// Links still on the way stay at the end
			if (a.pending !== b.pending) return a.pending ? 1 : -1;
			const x = key(a);
			const y = key(b);
			return x < y ? -sign : x > y ? sign : 0;
		});
	});

	function sortBy(key: SortKey) {
		if (sortKey !== key) {
			sortKey = key;
			descending = key === 'duration' || key === 'warnings';
		} else if (descending === (key === 'duration' || key === 'warnings')) {
			descending = !descending;
		} else {
			sortKey = null;
		}
	}

	const ariaSort = (key: SortKey) =>
		sortKey === key ? (descending ? 'descending' : 'ascending') : 'none';

	const open = new SvelteSet<string>();
	const toggle = (url: string) => (open.has(url) ? open.delete(url) : open.add(url));
</script>

{#snippet badges(item: Row)}
	{#if item.error}
		<span class="table__badge table__badge--error">{item.error}</span>
	{/if}
	{#if item.warnings?.length}
		<span class="table__badge table__badge--{worst(item)}">{item.warnings.length} SEO</span>
	{/if}
{/snippet}

{#snippet sortButton(key: SortKey, label: string)}
	<button type="button" class="table__sort" onclick={() => sortBy(key)}>
		{label}<span class="table__arrow" aria-hidden="true"
			>{sortKey === key ? (descending ? '↓' : '↑') : '↕'}</span
		>
	</button>
{/snippet}

<div class="table">
	<table>
		<thead>
			<tr>
				<th class="table__img"><span class="table__sr">Picture</span></th>
				<th aria-sort={ariaSort('title')}>{@render sortButton('title', 'Title and details')}</th>
				<th class="table__seo" aria-sort={ariaSort('warnings')}
					>{@render sortButton('warnings', 'Issues')}</th
				>
				<th class="table__type" aria-sort={ariaSort('type')}
					>{@render sortButton('type', 'Type')}</th
				>
				<th class="table__dur" aria-sort={ariaSort('duration')}
					>{@render sortButton('duration', 'Duration')}</th
				>
			</tr>
		</thead>
		<tbody>
			{#each sorted as item (item.url)}
				<tr
					class:has-error={item.error}
					class:is-pending={item.pending}
					class:is-open={open.has(item.url)}
					aria-busy={item.pending}
				>
					<td class="table__img">
						{#if item.pending}
							<span class="table__skeleton" aria-hidden="true"></span>
						{:else if item.ogImg?.ogImg}
							<img
								src={item.ogImg.ogImg}
								alt={item.ogImg.ogImgAlt || ''}
								loading="lazy"
								referrerpolicy="no-referrer"
								onerror={hide}
							/>
						{/if}
					</td>
					<td class="table__main">
						<p class="table__site">
							{#if item.favicon}
								<img
									class="table__favicon"
									src={item.favicon}
									alt=""
									width="16"
									height="16"
									loading="lazy"
									referrerpolicy="no-referrer"
									onerror={drop}
								/>
							{/if}
							<span>{item.siteName || hostOf(item.finalUrl || item.url)}</span>
						</p>
						<a class="table__title" href={item.url} target="_blank" rel="external noopener"
							>{item.title || item.url}</a
						>
						{#if item.pending}
							<p class="table__meta">Fetching…</p>
						{:else if metaOf(item).length || item.duration}
							<p class="table__meta">
								{metaOf(item).join(' · ')}<span class="table__dur-inline"
									>{metaOf(item).length && item.duration ? ' · ' : ''}{item.duration}</span
								>
							</p>
						{/if}
						{#if item.desc}
							<p class="table__desc">{item.desc}</p>
						{/if}
						{#if item.title}
							<p class="table__link">{item.url}</p>
						{/if}
						{#if item.error || item.warnings?.length}
							<p class="table__badges-inline">{@render badges(item)}</p>
						{/if}
						{#if !item.pending}
							<button
								type="button"
								class="table__more"
								aria-expanded={open.has(item.url)}
								onclick={() => toggle(item.url)}
								>{open.has(item.url) ? 'Hide details' : 'Details'}</button
							>
						{/if}
						{#if open.has(item.url)}
							<RowDetails {item} {advanced} />
						{/if}
					</td>
					<td class="table__seo">{@render badges(item)}</td>
					<td class="table__type">
						{item.pending ? '' : item.type}{#if item.service && item.service !== item.type}<br
							/><span class="table__service">{item.service}</span>{/if}
					</td>
					<td class="table__dur">{item.duration ?? ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if !rows.length}
		<p class="table__empty">Nothing matches the filter.</p>
	{/if}
</div>

<style>
	.table {
		overflow-x: auto;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}

	th {
		padding: 0.5rem;
		font-size: 0.7rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-align: left;
		text-transform: uppercase;
		color: #777;
		border-bottom: 1px solid #e2e2e2;
	}

	td {
		padding: 0.75rem 0.5rem;
		vertical-align: top;
		border-bottom: 1px solid #eee;
	}

	tr.has-error td {
		background: #fdf6f5;
	}

	tr.is-pending {
		color: #999;
	}

	.table__sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	.table__img {
		width: 6rem;
	}

	.table__img img,
	.table__skeleton {
		display: block;
		width: 6rem;
		aspect-ratio: 16 / 10;
		object-fit: cover;
		background: #f0f0f0;
		border-radius: 0.4rem;
	}

	.table__skeleton {
		background: linear-gradient(110deg, #ececec 30%, #f7f7f7 50%, #ececec 70%);
		background-size: 200% 100%;
		animation: table-shimmer 1.2s linear infinite;
	}

	@keyframes table-shimmer {
		to {
			background-position: -200% 0;
		}
	}

	.table__main p {
		margin: 0.15rem 0 0;
	}

	.table__site {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.75rem;
		color: #777;
	}

	.table__favicon {
		width: 1rem;
		height: 1rem;
		object-fit: contain;
	}

	.table__title {
		font-weight: 600;
		color: #1a1a1a;
		overflow-wrap: anywhere;
	}

	.table__meta {
		font-size: 0.8rem;
		color: #555;
	}

	/* Three lines in the table; the whole text is in the JSON */
	.table__desc {
		display: -webkit-box;
		overflow: hidden;
		color: #333;
		line-height: 1.45;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	.table__link {
		font-size: 0.75rem;
		color: #888;
		overflow-wrap: anywhere;
	}

	.table__badge {
		display: inline-block;
		margin: 0 0.25rem 0.25rem 0;
		padding: 0.1rem 0.45rem;
		font-size: 0.72rem;
		font-weight: 600;
		white-space: nowrap;
		border-radius: 0.35rem;
	}

	.table__badge--error {
		color: #fff;
		background: #c0392b;
	}

	.table__badge--warning {
		color: #6b4e00;
		background: #fdf1d3;
	}

	.table__badge--info {
		color: #555;
		background: #eee;
	}

	.table__seo {
		width: 7.5rem;
	}

	.table__sort {
		display: inline-flex;
		gap: 0.3rem;
		padding: 0;
		font: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;
	}

	.table__arrow {
		color: #bbb;
	}

	th[aria-sort='ascending'] .table__arrow,
	th[aria-sort='descending'] .table__arrow {
		color: #1a1a1a;
	}

	.table__more {
		display: block;
		margin-top: 0.35rem;
		padding: 0;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		color: #1a1a1a;
		text-decoration: underline;
		background: none;
		border: 0;
		cursor: pointer;
	}

	tr.is-open td {
		background: #fafafa;
	}

	.table__type,
	.table__dur {
		width: 5.5rem;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.table__service {
		font-size: 0.75rem;
		color: #777;
	}

	.table__dur-inline,
	.table__badges-inline {
		display: none;
	}

	.table__empty {
		padding: 1rem;
		text-align: center;
		color: #777;
	}

	/* Phones: picture and text only; the duration moves into the text */
	@media (max-width: 40rem) {
		.table__type,
		.table__dur,
		.table__seo {
			display: none;
		}

		.table__dur-inline {
			display: inline;
		}

		.table__badges-inline {
			display: block;
			margin-top: 0.4rem !important;
		}

		.table__img,
		.table__img img,
		.table__skeleton {
			width: 4.5rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.table__skeleton {
			animation: none;
		}
	}
</style>
