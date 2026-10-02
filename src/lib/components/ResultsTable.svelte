<script lang="ts">
	import type { Row } from '$lib/types';

	let { rows }: { rows: Row[] } = $props();

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
</script>

<div class="table">
	<table>
		<thead>
			<tr>
				<th class="table__img"><span class="table__sr">Picture</span></th>
				<th>Title and details</th>
				<th class="table__type">Type</th>
				<th class="table__dur">Duration</th>
			</tr>
		</thead>
		<tbody>
			{#each rows as item (item.url)}
				<tr class:has-error={item.error} class:is-pending={item.pending} aria-busy={item.pending}>
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
							<p class="table__badges">
								{#if item.error}
									<span class="table__badge table__badge--error">{item.error}</span>
								{/if}
								{#if item.warnings?.length}
									<span class="table__badge" title={item.warnings.map((w) => w.message).join('\n')}>
										{item.warnings.length} SEO {item.warnings.length === 1 ? 'warning' : 'warnings'}
									</span>
								{/if}
							</p>
						{/if}
					</td>
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

	.table__badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		margin-top: 0.4rem !important;
	}

	.table__badge {
		padding: 0.1rem 0.45rem;
		font-size: 0.72rem;
		font-weight: 600;
		color: #6b4e00;
		background: #fdf1d3;
		border-radius: 0.35rem;
	}

	.table__badge--error {
		color: #fff;
		background: #c0392b;
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

	.table__dur-inline {
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
		.table__dur {
			display: none;
		}

		.table__dur-inline {
			display: inline;
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
