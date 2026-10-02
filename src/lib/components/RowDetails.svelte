<script lang="ts">
	import type { Row } from '$lib/types';
	import { useI18n } from '$lib/i18n';
	import { seoWarning } from '$lib/i18n/messages';
	import type en from '$lib/i18n/en.json';

	let { item, advanced }: { item: Row; advanced: boolean } = $props();

	const i18n = useI18n();
	const ICONS = { error: '✕', warning: '!', info: 'i' };

	const date = (iso?: string) => {
		const time = Date.parse(iso ?? '');
		return Number.isNaN(time) ? '' : new Date(time).toLocaleString(i18n.locale);
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

	type FactKey = keyof (typeof en)['details']['facts'];
	const facts = $derived(
		[
			['finalUrl', item.finalUrl && item.finalUrl !== item.url ? item.finalUrl : ''],
			['status', item.status ?? ''],
			['responseTime', item.responseMs != null ? `${item.responseMs} ms` : ''],
			['lang', item.lang],
			['published', date(item.published)],
			['author', item.author],
			['canonical', item.canonical],
			['robots', item.robots],
			['keywords', item.keywords],
			['ogTitle', item.ogTitle !== item.title ? item.ogTitle : ''],
			['description', item.ogDesc && item.ogDesc !== item.desc ? item.ogDesc : ''],
			['stars', item.extra?.stars],
			['forks', item.extra?.forks],
			['license', item.extra?.license],
			['lastPush', date(item.extra?.updatedAt)],
			['archived', item.extra?.archived ? i18n.t('details.yes') : ''],
			['homepage', item.extra?.homepage],
			['links', item.urls?.length || ''],
			['images', item.htmlTags?.img?.length || '']
		].filter(([, value]) => value !== '' && value !== undefined && value !== null) as [
			FactKey,
			string | number
		][]
	);
</script>

<div class="details">
	{#if item.warnings?.length}
		<ul class="details__warnings" aria-label={i18n.t('details.warnings')}>
			{#each item.warnings as w (w.code)}
				<li class="details__warning details__warning--{w.level}">
					<span class="details__icon" aria-hidden="true">{ICONS[w.level]}</span>
					<span class="details__level">{i18n.t(`details.levels.${w.level}`)}</span>
					<span>{seoWarning(i18n.t, w)}</span>
				</li>
			{/each}
		</ul>
	{:else if advanced && item.type === 'page' && !item.service && !item.error}
		<p class="details__ok">✓ {i18n.t('details.noWarnings')}</p>
	{/if}

	{#if facts.length}
		<dl class="details__facts">
			{#each facts as [label, value] (label)}
				<dt>{i18n.t(`details.facts.${label}`)}</dt>
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
		<p class="details__hint">{i18n.t('details.hint')}</p>
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
		width: 5.5rem;
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
