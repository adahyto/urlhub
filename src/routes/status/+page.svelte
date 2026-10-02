<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let status = $derived(data.status);
	let api = $derived(status.api);

	const REFRESH_MS = 30_000;

	// Times are in the viewer's zone: the server (UTC) leaves them out, the browser fills them in
	let mounted = $state(false);

	onMount(() => {
		mounted = true;
		// Reload the numbers while the tab is visible; at once when it comes back
		const timer = setInterval(() => {
			if (document.visibilityState === 'visible') invalidateAll();
		}, REFRESH_MS);
		const onVisible = () => document.visibilityState === 'visible' && invalidateAll();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});

	const number = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
	const time = (iso: string) =>
		mounted ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
	const hour = (iso: string) =>
		mounted ? new Date(iso).toLocaleTimeString([], { hour: '2-digit' }) : '';
	const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
	const percent = (part: number, whole: number) =>
		whole ? `${Math.round((part / whole) * 100)}%` : '–';
	const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	const uptime = (seconds: number) => {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		return days ? `${days} d ${hours} h` : hours ? `${hours} h ${minutes} min` : `${minutes} min`;
	};

	let peak = $derived(Math.max(0, ...(api?.hours ?? []).map((h) => h.links)));
	// Scale of the bars; an empty day still draws a flat chart
	let maxLinks = $derived(Math.max(1, peak));
	let quota = $derived(api ? api.youtube.unitsUsed / api.youtube.dailyUnits : 0);
	let quotaLevel = $derived(quota >= 0.95 ? 'critical' : quota >= 0.8 ? 'warning' : 'ok');
	let active = $state<number | null>(null);
</script>

<svelte:head>
	<title>urlhub – status</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="status">
	<header class="status__header">
		<h1 class="status__title">Status</h1>
		<p class="status__muted">
			Checked at {time(status.checkedAt)} · refreshes every 30 s · counts only, no links
		</p>
	</header>

	<ul class="status__checks" role="list">
		{#each status.checks as item (item.name)}
			<li class="check" class:check--down={!item.ok}>
				<span class="check__icon" aria-hidden="true">{item.ok ? '✓' : '✕'}</span>
				<span class="check__name">{item.name}</span>
				<span class="check__state">{item.ok ? 'up' : 'down'}</span>
				<span class="status__muted">{item.detail}{item.ms ? ` · ${item.ms} ms` : ''}</span>
			</li>
		{/each}
	</ul>

	{#if api}
		<section class="status__section" aria-labelledby="counts">
			<h2 id="counts" class="status__heading">ldb-api</h2>
			<p class="status__muted">
				Up for {uptime(api.uptimeSeconds)} · Node {api.node} · counts start again at every restart
			</p>
			<div class="tiles">
				{#each [['Last hour', api.lastHour], ['Last 24 hours', api.last24h]] as const as [label, c] (label)}
					<div class="tile">
						<p class="tile__label">{label}</p>
						<p class="tile__value">
							{number.format(c.links)} <span class="tile__unit">links</span>
						</p>
						<p class="tile__detail">
							{c.requests} requests · {c.failed} failed ({percent(c.failed, c.links)}) · {c.cached}
							from memory
						</p>
						<p class="tile__detail">{c.cancelled} cancelled · {c.refused} refused (limits)</p>
					</div>
				{/each}
			</div>
		</section>

		<section class="status__section" aria-labelledby="hours">
			<h2 id="hours" class="status__heading">Links per hour, last 24 hours</h2>
			<div class="chart">
				<div
					class="chart__plot"
					role="img"
					aria-label="Links per hour; the same numbers are in the table below"
				>
					{#each api.hours as h, i (h.start)}
						<button
							type="button"
							class="chart__slot"
							class:is-active={active === i}
							onmouseenter={() => (active = i)}
							onmouseleave={() => (active = null)}
							onfocus={() => (active = i)}
							onblur={() => (active = null)}
							aria-label="{time(h.start)}: {h.links} links, {h.failed} failed"
						>
							<span class="chart__bar" style:height="{(h.links / maxLinks) * 100}%"></span>
						</button>
					{/each}
					{#if active !== null}
						{@const h = api.hours[active]}
						<div
							class="chart__tip"
							style:left="{((active + 0.5) / api.hours.length) * 100}%"
							class:chart__tip--left={active > api.hours.length - 5}
							class:chart__tip--right={active < 4}
						>
							<strong>{time(h.start)}</strong><br />
							{h.links} links · {h.failed} failed<br />
							{h.requests} requests · {h.cached} from memory
						</div>
					{/if}
				</div>
				<div class="chart__axis" aria-hidden="true">
					{#each api.hours as h, i (h.start)}
						<span>{i % 6 === 0 || i === api.hours.length - 1 ? hour(h.start) : ''}</span>
					{/each}
				</div>
				<p class="status__muted">Busiest hour: {peak} links</p>
			</div>
			<details class="status__table">
				<summary>Table</summary>
				<table>
					<thead>
						<tr
							><th>Hour</th><th>Requests</th><th>Links</th><th>Failed</th><th>From memory</th><th
								>Cancelled</th
							></tr
						>
					</thead>
					<tbody>
						{#each [...api.hours].reverse() as h (h.start)}
							<tr>
								<td>{time(h.start)}</td><td>{h.requests}</td><td>{h.links}</td><td>{h.failed}</td
								><td>{h.cached}</td><td>{h.cancelled}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</details>
		</section>

		<section class="status__section" aria-labelledby="youtube">
			<h2 id="youtube" class="status__heading">YouTube Data API</h2>
			{#if api.youtube.apiKey}
				<p class="tile__detail">
					{api.youtube.unitsUsed.toLocaleString('en')} of {api.youtube.dailyUnits.toLocaleString(
						'en'
					)}
					units today ({percent(api.youtube.unitsUsed, api.youtube.dailyUnits)}) · the day starts
					again at midnight Pacific Time
				</p>
				<div
					class="meter meter--{quotaLevel}"
					role="meter"
					aria-label="YouTube quota used today"
					aria-valuemin={0}
					aria-valuemax={api.youtube.dailyUnits}
					aria-valuenow={api.youtube.unitsUsed}
				>
					<span class="meter__fill" style:width="{Math.min(100, quota * 100)}%"></span>
				</div>
				{#if api.youtube.problem}
					<p class="status__problem">⚠ {api.youtube.problem}: videos come from oEmbed for now</p>
				{/if}
			{:else}
				<p class="status__problem">
					⚠ No API key: videos come from oEmbed (no description or duration)
				</p>
			{/if}
			<p class="status__muted">
				{plural(api.lastHour.youtubeApiCalls, 'API call')} and {plural(
					api.lastHour.youtubeOembed,
					'oEmbed request'
				)}
				in the last hour
			</p>
		</section>

		<section class="status__section" aria-labelledby="cache">
			<h2 id="cache" class="status__heading">Memory</h2>
			<p class="tile__detail">
				{plural(api.cache.pages.entries, 'page')} ({megabytes(api.cache.pages.bytes)} of 64 MB) for 30
				min ·
				{plural(api.cache.videos.entries, 'video')} for 1 h
			</p>
		</section>
	{:else}
		<p class="status__problem">⚠ ldb-api does not answer, so there are no counts to show.</p>
	{/if}

	<p class="status__muted"><a href={resolve('/')}>← urlhub</a></p>
</main>

<style>
	.status {
		--ink: #1a1a1a;
		--muted: #6b6b6b;
		--surface: #fcfcfb;
		--card: #f3f3f1;
		--border: #e2e2e2;
		--bar: #2a78d6;
		--bar-track: #cde2fb;
		--good: #0ca30c;
		--warning: #fab219;
		--critical: #d03b3b;

		box-sizing: border-box;
		min-height: 100vh;
		/* 48rem of content, the surface full width */
		padding: 1.5rem max(1rem, calc((100% - 48rem) / 2)) 3rem;
		color: var(--ink);
		background: var(--surface);
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	@media (prefers-color-scheme: dark) {
		.status {
			--ink: #ececea;
			--muted: #a3a3a0;
			--surface: #1a1a19;
			--card: #262624;
			--border: #383835;
			--bar: #3987e5;
			--bar-track: #184f95;
		}
	}

	:global(body) {
		margin: 0;
	}

	.status a {
		color: inherit;
	}

	.status__title {
		margin: 0;
		font-size: 1.6rem;
	}

	.status__heading {
		margin: 0 0 0.25rem;
		font-size: 1rem;
	}

	.status__muted {
		margin: 0.25rem 0;
		font-size: 0.8rem;
		color: var(--muted);
	}

	.status__section {
		margin-top: 2rem;
	}

	.status__problem {
		margin: 0.5rem 0;
		font-size: 0.9rem;
	}

	.status__checks {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 0.5rem;
		margin: 1.25rem 0 0;
		padding: 0;
		list-style: none;
	}

	.check {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.1rem 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--card);
		border-radius: 0.75rem;
	}

	.check .status__muted {
		grid-column: 2 / -1;
		margin: 0;
	}

	.check__icon {
		color: var(--good);
		font-weight: 700;
	}

	.check--down .check__icon {
		color: var(--critical);
	}

	.check__name {
		font-weight: 600;
	}

	.check__state {
		font-size: 0.8rem;
		font-weight: 600;
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: 0.5rem;
		margin-top: 0.75rem;
	}

	.tile {
		padding: 1rem;
		background: var(--card);
		border-radius: 0.75rem;
	}

	.tile p {
		margin: 0;
	}

	.tile__label {
		font-size: 0.8rem;
		color: var(--muted);
	}

	.tile__value {
		margin: 0.15rem 0 0.35rem !important;
		font-size: 2rem;
		font-weight: 600;
	}

	.tile__unit {
		font-size: 0.9rem;
		font-weight: 400;
		color: var(--muted);
	}

	.tile__detail {
		margin: 0.25rem 0;
		font-size: 0.85rem;
	}

	.chart {
		margin-top: 0.75rem;
	}

	.chart__plot {
		position: relative;
		display: grid;
		grid-template-columns: repeat(24, 1fr);
		height: 9rem;
		border-bottom: 1px solid var(--border);
	}

	.chart__slot {
		display: flex;
		align-items: flex-end;
		height: 100%;
		padding: 0 1px;
		border: 0;
		background: none;
		cursor: default;
	}

	.chart__bar {
		width: 100%;
		min-height: 0;
		background: var(--bar);
		border-radius: 4px 4px 0 0;
	}

	.chart__slot.is-active,
	.chart__slot:focus-visible {
		background: var(--card);
		outline: none;
	}

	.chart__tip {
		position: absolute;
		bottom: calc(100% + 0.25rem);
		transform: translateX(-50%);
		z-index: 1;
		padding: 0.4rem 0.6rem;
		font-size: 0.75rem;
		line-height: 1.4;
		white-space: nowrap;
		color: var(--surface);
		background: var(--ink);
		border-radius: 0.4rem;
		pointer-events: none;
	}

	.chart__tip--left {
		transform: translateX(-90%);
	}

	.chart__tip--right {
		transform: translateX(-10%);
	}

	.chart__axis {
		display: grid;
		grid-template-columns: repeat(24, 1fr);
		font-size: 0.7rem;
		color: var(--muted);
		font-variant-numeric: tabular-nums;
	}

	.chart__axis span {
		overflow: visible;
		white-space: nowrap;
	}

	.status__table summary {
		margin-top: 0.5rem;
		font-size: 0.85rem;
		cursor: pointer;
	}

	/* On a phone the table scrolls sideways instead of widening the page */
	.status__table {
		overflow-x: auto;
	}

	.status__table td:first-child {
		white-space: nowrap;
	}

	.status__table table {
		width: 100%;
		margin-top: 0.5rem;
		border-collapse: collapse;
		font-size: 0.8rem;
		font-variant-numeric: tabular-nums;
	}

	.status__table th,
	.status__table td {
		padding: 0.25rem 0.5rem;
		text-align: right;
		border-bottom: 1px solid var(--border);
	}

	.status__table th:first-child,
	.status__table td:first-child {
		text-align: left;
	}

	.meter {
		height: 0.6rem;
		margin: 0.5rem 0;
		overflow: hidden;
		background: var(--bar-track);
		border-radius: 0.3rem;
	}

	.meter__fill {
		display: block;
		height: 100%;
		background: var(--bar);
	}

	.meter--warning .meter__fill {
		background: var(--warning);
	}

	.meter--critical .meter__fill {
		background: var(--critical);
	}
</style>
