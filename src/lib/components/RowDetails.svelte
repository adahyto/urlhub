<script lang="ts">
	import type { Row } from '$lib/types';

	let { item, advanced }: { item: Row; advanced: boolean } = $props();

	const LEVELS = {
		error: { icon: '✕', label: 'Error' },
		warning: { icon: '!', label: 'Warning' },
		info: { icon: 'i', label: 'Note' }
	};

	const date = (iso?: string) => {
		const time = Date.parse(iso ?? '');
		return Number.isNaN(time) ? '' : new Date(time).toLocaleString();
	};

	// htmlTags hold each element's HTML; the panel shows its text
	const textOf = (html: string) =>
		html
			.replace(/<[^>]+>/g, ' ')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/\s+/g, ' ')
			.trim();

	const headings = $derived(
		(['h1', 'h2', 'h3'] as const)
			.map((tag) => ({
				tag,
				texts: (item.htmlTags?.[tag] ?? []).map(textOf).filter(Boolean).slice(0, 10),
				count: item.htmlTags?.[tag]?.length ?? 0
			}))
			.filter((h) => h.count)
	);

	const facts = $derived(
		[
			['Final address', item.finalUrl && item.finalUrl !== item.url ? item.finalUrl : ''],
			['HTTP status', item.status ?? ''],
			['Response time', item.responseMs != null ? `${item.responseMs} ms` : ''],
			['Language', item.lang],
			['Published', date(item.published)],
			['Author', item.author],
			['Canonical', item.canonical],
			['Robots', item.robots],
			['Keywords', item.keywords],
			['Open Graph title', item.ogTitle !== item.title ? item.ogTitle : ''],
			['Description', item.ogDesc && item.ogDesc !== item.desc ? item.ogDesc : ''],
			['Stars', item.extra?.stars],
			['Forks', item.extra?.forks],
			['License', item.extra?.license],
			['Last push', date(item.extra?.updatedAt)],
			['Archived', item.extra?.archived ? 'yes' : ''],
			['Homepage', item.extra?.homepage],
			['Links on the page', item.urls?.length || ''],
			['Images', item.htmlTags?.img?.length || '']
		].filter(([, value]) => value !== '' && value !== undefined && value !== null) as [
			string,
			string | number
		][]
	);
</script>

<div class="details">
	{#if item.warnings?.length}
		<ul class="details__warnings" aria-label="SEO warnings">
			{#each item.warnings as w (w.code)}
				<li class="details__warning details__warning--{w.level}">
					<span class="details__icon" aria-hidden="true">{LEVELS[w.level].icon}</span>
					<span class="details__level">{LEVELS[w.level].label}</span>
					<span>{w.message}</span>
				</li>
			{/each}
		</ul>
	{:else if advanced && item.type === 'page' && !item.service && !item.error}
		<p class="details__ok">✓ No SEO warnings</p>
	{/if}

	{#if facts.length}
		<dl class="details__facts">
			{#each facts as [label, value] (label)}
				<dt>{label}</dt>
				<dd>{value}</dd>
			{/each}
		</dl>
	{/if}

	{#each headings as h (h.tag)}
		<p class="details__heading">
			<strong>&lt;{h.tag}&gt; × {h.count}:</strong>
			{h.texts.join(' · ')}{h.count > h.texts.length ? ' …' : ''}
		</p>
	{/each}

	{#if !advanced && item.type === 'page' && !item.service}
		<p class="details__hint">Fetch with the advanced option for SEO warnings, headings and more.</p>
	{/if}
</div>

<style>
	.details {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.25rem 0 0.5rem;
		font-size: 0.8rem;
	}

	.details p {
		margin: 0;
	}

	.details__warnings {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.details__warning {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}

	.details__icon {
		display: inline-grid;
		flex: none;
		place-items: center;
		width: 1.1rem;
		height: 1.1rem;
		font-size: 0.7rem;
		font-weight: 700;
		color: #fff;
		border-radius: 50%;
	}

	.details__level {
		flex: none;
		width: 4.2rem;
		font-weight: 600;
	}

	.details__warning--error .details__icon {
		background: #d03b3b;
	}

	.details__warning--warning .details__icon {
		color: #1a1a1a;
		background: #fab219;
	}

	.details__warning--info .details__icon {
		background: #8a8a8a;
	}

	.details__ok {
		color: var(--success);
	}

	.details__facts {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: 0.2rem 1rem;
		margin: 0;
	}

	.details__facts dt {
		color: var(--muted);
	}

	.details__facts dd {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.details__heading {
		line-height: 1.45;
	}

	.details__hint {
		color: var(--muted);
	}

	@media (max-width: 40rem) {
		.details__facts {
			grid-template-columns: 1fr;
		}

		.details__facts dd {
			margin-bottom: 0.3rem;
		}
	}
</style>
