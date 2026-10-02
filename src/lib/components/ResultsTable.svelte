<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import RowDetails from './RowDetails.svelte';
	import type { Row } from '$lib/types';
	import { has, useI18n, type Key } from '$lib/i18n';
	import { linkError } from '$lib/i18n/messages';

	const i18n = useI18n();
	const typeName = (type: string) => (has(`types.${type}`) ? i18n.t(`types.${type}` as Key) : type);

	interface Props {
		rows: Row[];
		advanced: boolean;
		/** Whether rows can be removed (not while a query fills them) */
		removable?: boolean;
		/** Whether rows can be moved (also not while the list is filtered; not while sorted, see below) */
		movable?: boolean;
		onremove?: (url: string) => void;
		onmove?: (url: string, to: number | { before: string }) => void;
	}

	let { rows, advanced, removable = false, movable = false, onremove, onmove }: Props = $props();

	const hostOf = (u: string) => {
		try {
			return new URL(u).hostname.replace(/^www\./, '');
		} catch {
			return u;
		}
	};

	const date = (iso?: string) => {
		const time = Date.parse(iso ?? '');
		return Number.isNaN(time) ? '' : new Date(time).toLocaleDateString(i18n.locale);
	};

	const number = $derived(
		new Intl.NumberFormat(i18n.locale, { notation: 'compact', maximumFractionDigits: 1 })
	);

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

	// Columns only when something fills them: durations come with videos, issues with errors or SEO warnings
	const hasDuration = $derived(rows.some((r) => r.duration));
	const hasIssues = $derived(rows.some((r) => r.error || r.warnings?.length));

	const open = new SvelteSet<string>();
	const toggle = (url: string) => (open.has(url) ? open.delete(url) : open.add(url));

	// A sorted table shows another order than the list's, so rows move only when it is not sorted
	const canMove = $derived(movable && !sortKey);

	// Rows are dragged by their handle and dropped onto another row, which they then precede
	let dragged = $state<string | null>(null);
	let over = $state<string | null>(null);

	function dropOn(event: DragEvent, target: string) {
		event.preventDefault();
		if (dragged && dragged !== target) onmove?.(dragged, { before: target });
		dragged = over = null;
	}
</script>

{#snippet badges(item: Row)}
	{#if item.error}
		<span class="table__badge table__badge--error">{linkError(i18n.t, item.error)}</span>
	{/if}
	{#if item.warnings?.length}
		<span class="table__badge table__badge--{worst(item)}"
			>{i18n.t('table.seo', { count: item.warnings.length })}</span
		>
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
				<th class="table__img"><span class="table__sr">{i18n.t('table.picture')}</span></th>
				<th aria-sort={ariaSort('title')}>{@render sortButton('title', i18n.t('table.title'))}</th>
				{#if hasIssues}<th class="table__seo" aria-sort={ariaSort('warnings')}
						>{@render sortButton('warnings', i18n.t('table.issues'))}</th
					>{/if}
				<th class="table__type" aria-sort={ariaSort('type')}
					>{@render sortButton('type', i18n.t('table.type'))}</th
				>
				{#if hasDuration}<th class="table__dur" aria-sort={ariaSort('duration')}
						>{@render sortButton('duration', i18n.t('table.duration'))}</th
					>{/if}
			</tr>
		</thead>
		<tbody>
			{#each sorted as item, i (item.url)}
				<tr
					class:is-dragged={dragged === item.url}
					class:is-drop-target={over === item.url && dragged !== item.url}
					ondragover={(e) => {
						if (!dragged) return;
						e.preventDefault();
						over = item.url;
					}}
					ondragleave={() => over === item.url && (over = null)}
					ondrop={(e) => dropOn(e, item.url)}
					class:has-error={item.error}
					class:is-pending={item.pending}
					class:is-open={open.has(item.url)}
					aria-busy={item.pending}
				>
					<td class="table__img">
						{#if canMove}
							<span
								class="table__handle"
								draggable="true"
								role="presentation"
								title={i18n.t('table.drag')}
								ondragstart={(e) => {
									dragged = item.url;
									e.dataTransfer?.setData('text/plain', item.url);
									const row = (e.currentTarget as HTMLElement).closest('tr');
									if (row) e.dataTransfer?.setDragImage(row, 20, 20);
								}}
								ondragend={() => (dragged = over = null)}>⠿</span
							>
						{/if}
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
							<p class="table__meta">{i18n.t('table.fetching')}</p>
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
							<div class="table__actions">
								<button
									type="button"
									class="table__more"
									aria-expanded={open.has(item.url)}
									onclick={() => toggle(item.url)}
									>{i18n.t(open.has(item.url) ? 'table.hideDetails' : 'table.details')}</button
								>
								{#if removable}
									<span class="table__edit">
										{#if canMove}
											<button
												type="button"
												aria-label={i18n.t('table.up')}
												disabled={i === 0}
												onclick={() => onmove?.(item.url, -1)}>↑</button
											>
											<button
												type="button"
												aria-label={i18n.t('table.down')}
												disabled={i === sorted.length - 1}
												onclick={() => onmove?.(item.url, 1)}>↓</button
											>
										{/if}
										<button type="button" onclick={() => onremove?.(item.url)}
											>{i18n.t('table.remove')}</button
										>
									</span>
								{/if}
							</div>
						{/if}
						{#if open.has(item.url)}
							<RowDetails {item} {advanced} />
						{/if}
					</td>
					{#if hasIssues}<td class="table__seo">{@render badges(item)}</td>{/if}
					<td class="table__type">
						{item.pending
							? ''
							: typeName(item.type)}{#if item.service && item.service !== item.type}<br /><span
								class="table__service">{item.service}</span
							>{/if}
					</td>
					{#if hasDuration}<td class="table__dur">{item.duration ?? ''}</td>{/if}
				</tr>
			{/each}
		</tbody>
	</table>
	{#if !rows.length}
		<p class="table__empty">{i18n.t('table.nothing')}</p>
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
		color: var(--muted);
		border-bottom: 1px solid var(--border);
	}

	td {
		padding: 0.75rem 0.5rem;
		vertical-align: top;
		border-bottom: 1px solid var(--border-soft);
	}

	tr.has-error td {
		background: var(--row-error);
	}

	tr.is-pending {
		color: var(--faint);
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
		background: var(--surface-3);
		border-radius: 0.4rem;
	}

	.table__skeleton {
		background: linear-gradient(
			110deg,
			var(--skeleton-a) 30%,
			var(--skeleton-b) 50%,
			var(--skeleton-a) 70%
		);
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
		color: var(--muted);
	}

	.table__favicon {
		width: 1rem;
		height: 1rem;
		object-fit: contain;
	}

	/* Many site icons are black (GitHub, X): on the dark theme they get a light square, as in browser tabs */
	@media (prefers-color-scheme: dark) {
		.table__favicon {
			padding: 1px;
			background: #fff;
			border-radius: 0.2rem;
		}
	}

	.table__title {
		font-weight: 600;
		color: var(--ink);
		overflow-wrap: anywhere;
	}

	.table__meta {
		font-size: 0.8rem;
		color: var(--ink-3);
	}

	/* Three lines in the table; the whole text is in the JSON */
	.table__desc {
		display: -webkit-box;
		overflow: hidden;
		color: var(--ink-2);
		line-height: 1.45;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
	}

	.table__link {
		font-size: 0.75rem;
		color: var(--faint);
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
		background: var(--error-solid);
	}

	.table__badge--warning {
		color: var(--warning-ink);
		background: var(--warning-bg);
	}

	.table__badge--info {
		color: var(--info-ink);
		background: var(--info-bg);
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
		color: var(--faint);
	}

	th[aria-sort='ascending'] .table__arrow,
	th[aria-sort='descending'] .table__arrow {
		color: var(--ink);
	}

	.table__edit {
		display: inline-flex;
		gap: 0.75rem;
		margin-left: 1rem;
	}

	.table__edit button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.75rem;
		min-height: 1.75rem;
		padding: 0 0.25rem;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--muted);
		text-decoration: underline;
		background: none;
		border: 0;
		cursor: pointer;
	}

	.table__edit button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.table__handle {
		display: block;
		margin-bottom: 0.25rem;
		font-size: 1rem;
		line-height: 1;
		color: var(--faint);
		cursor: grab;
		user-select: none;
	}

	tr.is-dragged td {
		opacity: 0.4;
	}

	tr.is-drop-target td {
		box-shadow: inset 0 3px 0 var(--ink);
	}

	.table__actions {
		margin-top: 0.35rem;
	}

	.table__more {
		display: inline-block;
		padding: 0;
		font: inherit;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--ink);
		text-decoration: underline;
		background: none;
		border: 0;
		cursor: pointer;
	}

	tr.is-open td {
		background: var(--row-open);
	}

	.table__type,
	.table__dur {
		width: 5.5rem;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.table__service {
		font-size: 0.75rem;
		color: var(--muted);
	}

	.table__dur-inline,
	.table__badges-inline {
		display: none;
	}

	.table__empty {
		padding: 1rem;
		text-align: center;
		color: var(--muted);
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
