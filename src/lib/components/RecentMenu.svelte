<script lang="ts">
	import Menu from './Menu.svelte';
	import type { Recent, RecentQueries } from '$lib/history.svelte';
	import { useI18n } from '$lib/i18n';

	/* Recent queries in a menu next to Fetch (lib/history.svelte.ts: this visit's always, stored only once the switch is on) */
	let { recent, onopen }: { recent: RecentQueries; onopen: (entry: Recent) => void } = $props();

	const i18n = useI18n();

	const hosts = (urls: string[]) => {
		const names = urls
			.map((u) => {
				try {
					return new URL(u).hostname.replace(/^www\./, '');
				} catch {
					return '';
				}
			})
			.filter((h, i, all) => h && all.indexOf(h) === i);
		return names.slice(0, 3).join(', ') + (names.length > 3 ? ` +${names.length - 3}` : '');
	};

	const when = (at: number) =>
		new Date(at).toLocaleString(i18n.locale, { dateStyle: 'short', timeStyle: 'short' });
</script>

{#if recent.available}
	<Menu
		label={i18n.t('recent.button')}
		badge={recent.entries.length ? String(recent.entries.length) : ''}
	>
		{#snippet children(close)}
			{#if recent.entries.length}
				<ul class="recent">
					{#each recent.entries as entry (entry.at)}
						<li class="recent__item">
							<button
								type="button"
								class="menu__item recent__open"
								onclick={() => {
									close();
									onopen(entry);
								}}
							>
								{i18n.t('recent.links', { count: entry.urls.length })} · {hosts(entry.urls)}
								<small
									>{when(entry.at)} · {i18n.t(`views.${entry.view}`)}{entry.advanced
										? i18n.t('recent.advanced')
										: ''}</small
								>
							</button>
							<button
								type="button"
								class="recent__remove"
								aria-label={i18n.t('recent.remove')}
								onclick={() => recent.remove(entry)}>×</button
							>
						</li>
					{/each}
				</ul>
				<button type="button" class="menu__item" onclick={() => recent.clear()}
					>{i18n.t('recent.clear')}</button
				>
				{#if !recent.enabled}
					<p class="recent__note">{i18n.t('recent.visitOnly')}</p>
				{/if}
			{:else}
				<p class="recent__note">{i18n.t('recent.empty')}</p>
			{/if}
			<label class="recent__switch">
				<input
					type="checkbox"
					checked={recent.enabled}
					onchange={(e) => recent.setEnabled((e.currentTarget as HTMLInputElement).checked)}
				/>
				<span>{i18n.t('recent.remember')}</span>
			</label>
			<p class="recent__note">{i18n.t('recent.note')}</p>
		{/snippet}
	</Menu>
{/if}

<style>
	.recent {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.recent__item {
		display: flex;
		align-items: stretch;
	}

	.recent__remove {
		flex: none;
		width: 2rem;
		padding: 0;
		font: inherit;
		font-size: 1.1rem;
		color: var(--muted);
		background: none;
		border: 0;
		border-radius: 0.45rem;
		cursor: pointer;
	}

	.recent__remove:hover,
	.recent__remove:focus-visible {
		color: var(--error);
		background: var(--surface-3);
		outline: none;
	}

	.recent__switch {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.25rem;
		padding: 0.5rem 0.65rem 0;
		font-size: 0.85rem;
		border-top: 1px solid var(--border-soft);
		cursor: pointer;
	}

	/* No line above the switch when there is nothing above it */
	.recent__switch:first-child {
		margin-top: 0;
		padding-top: 0.5rem;
		border-top: 0;
	}

	.recent__switch input {
		margin: 0;
		accent-color: var(--accent);
	}

	.recent__note {
		margin: 0;
		padding: 0.25rem 0.65rem 0.35rem;
		font-size: 0.72rem;
		color: var(--muted);
	}
</style>
