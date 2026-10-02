<script lang="ts">
	import type { Recent, RecentQueries } from '$lib/history.svelte';

	let { recent, onopen }: { recent: RecentQueries; onopen: (entry: Recent) => void } = $props();

	const VIEW_LABELS = { tiles: 'tiles', table: 'table', json: 'JSON' };

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
		new Date(at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
</script>

{#if recent.available}
	<details class="recent">
		<summary class="recent__summary">
			Recent queries{recent.enabled && recent.entries.length ? ` (${recent.entries.length})` : ''}
		</summary>

		<label class="recent__switch">
			<input
				type="checkbox"
				checked={recent.enabled}
				onchange={(e) => recent.setEnabled((e.currentTarget as HTMLInputElement).checked)}
			/>
			<span>Remember recent queries on this device</span>
		</label>
		<p class="recent__note">
			Kept only in this browser, never sent anywhere. Turning this off deletes them.
		</p>

		{#if recent.enabled}
			{#if recent.entries.length}
				<ul class="recent__list">
					{#each recent.entries as entry (entry.at)}
						<li class="recent__item">
							<button type="button" class="recent__open" onclick={() => onopen(entry)}>
								<span class="recent__when">{when(entry.at)}</span>
								<span class="recent__what">
									{entry.urls.length}
									{entry.urls.length === 1 ? 'link' : 'links'} · {hosts(entry.urls)}
								</span>
								<span class="recent__view"
									>{VIEW_LABELS[entry.view]}{entry.advanced ? ', advanced' : ''}</span
								>
							</button>
							<button
								type="button"
								class="recent__remove"
								aria-label="Remove from recent queries"
								onclick={() => recent.remove(entry)}>×</button
							>
						</li>
					{/each}
				</ul>
				<button type="button" class="recent__clear" onclick={() => recent.clear()}>Clear all</button
				>
			{:else}
				<p class="recent__note">Nothing yet: your next queries will show up here.</p>
			{/if}
		{/if}
	</details>
{/if}

<style>
	.recent {
		box-sizing: border-box;
		width: 100%;
		max-width: 40rem;
		margin-inline: auto;
		font-size: 0.85rem;
	}

	.recent__summary {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.recent__switch {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.75rem;
		cursor: pointer;
	}

	.recent__switch input {
		margin: 0;
		accent-color: #1a1a1a;
	}

	.recent__note {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		color: #777;
	}

	.recent__list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0.75rem 0 0;
		padding: 0;
		list-style: none;
	}

	.recent__item {
		display: flex;
		align-items: stretch;
		background: #f7f7f7;
		border-radius: 0.6rem;
	}

	.recent__open {
		display: flex;
		flex: 1;
		flex-wrap: wrap;
		gap: 0.15rem 0.75rem;
		min-width: 0;
		padding: 0.55rem 0.75rem;
		font: inherit;
		text-align: left;
		color: #1a1a1a;
		background: none;
		border: 0;
		cursor: pointer;
	}

	.recent__open:hover .recent__what {
		text-decoration: underline;
	}

	.recent__when,
	.recent__view {
		color: #777;
		white-space: nowrap;
	}

	.recent__what {
		overflow-wrap: anywhere;
	}

	.recent__remove {
		padding: 0 0.85rem;
		font: inherit;
		font-size: 1.1rem;
		color: #777;
		background: none;
		border: 0;
		cursor: pointer;
	}

	.recent__remove:hover {
		color: #c0392b;
	}

	.recent__clear {
		margin-top: 0.5rem;
		padding: 0;
		font: inherit;
		font-size: 0.75rem;
		text-decoration: underline;
		color: #555;
		background: none;
		border: 0;
		cursor: pointer;
	}
</style>
