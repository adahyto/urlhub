<script lang="ts">
	import { MAX_URLS, roughCount } from '$lib/query.svelte';

	interface Props {
		/** The text in the field: links as typed, ldb-api finds them */
		text: string;
		advanced: boolean;
		/** The advanced option means something for the table and JSON, not for tiles */
		showAdvanced: boolean;
		loading: boolean;
		ready: number;
		total: number;
		error: string | null;
		onsubmit: () => void;
		onstop: () => void;
	}

	let {
		text = $bindable(),
		advanced = $bindable(),
		showAdvanced,
		loading,
		ready,
		total,
		error,
		onsubmit,
		onstop
	}: Props = $props();

	const count = $derived(roughCount(text));
	let notice = $state('');

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!loading) onsubmit();
	}

	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !loading) {
			event.preventDefault();
			onsubmit();
		}
	}

	// The file is read here, in the browser; its text joins the field and ldb-api finds the links in it
	async function addFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const added = await file.text();
		text = [text.trim(), added.trim()].filter(Boolean).join('\n');
		notice = `${roughCount(added)} links added from ${file.name}`;
		setTimeout(() => (notice = ''), 2500);
	}
</script>

<form onsubmit={submit} class="url-form" novalidate>
	<div class="url-form__field">
		<label class="url-form__label" for="urls">Enter URLs</label>
		<span class="url-form__hint"
			>Separate with spaces, commas, or new lines · Ctrl + Enter fetches</span
		>

		<textarea
			id="urls"
			class="url-form__textarea"
			bind:value={text}
			{onkeydown}
			rows="4"
			spellcheck="false"
			disabled={loading}></textarea>

		<div class="url-form__row">
			<span class="url-form__hint" class:url-form__hint--warn={count > MAX_URLS}>
				{count}
				{count === 1 ? 'link' : 'links'}{count > MAX_URLS ? ` — at most ${MAX_URLS} at once` : ''}
			</span>
			<label class="url-form__file">
				Add links from a .txt file
				<input type="file" accept=".txt,text/plain" onchange={addFile} disabled={loading} />
			</label>
		</div>
	</div>

	{#if showAdvanced}
		<label class="url-form__check">
			<input type="checkbox" bind:checked={advanced} disabled={loading} />
			<span>
				Advanced: SEO warnings, keywords, Open Graph, canonical, robots, links and headings of each
				page
			</span>
		</label>
	{/if}

	<div class="url-form__buttons">
		<button type="submit" class="url-form__submit" disabled={loading}>
			{#if loading}
				<span class="url-form__spinner" aria-hidden="true"></span>
				<span>Loading… {ready} / {total}</span>
			{:else}
				<span>Fetch</span>
			{/if}
		</button>
		{#if loading}
			<button type="button" class="url-form__stop" onclick={onstop}>Stop</button>
		{/if}
	</div>

	{#if error}
		<p class="url-form__error" role="alert">{error}</p>
	{/if}
	{#if notice}
		<p class="url-form__notice" role="status">{notice}</p>
	{/if}
</form>

<style>
	.url-form {
		--accent: #1a1a1a;
		--surface: #f7f7f7;
		--border: #e2e2e2;
		--error: #c0392b;

		display: flex;
		flex-direction: column;
		gap: 1rem;
		width: 100%;
		max-width: 40rem;
		margin-inline: auto;
		font-family:
			'Inter',
			system-ui,
			-apple-system,
			'Segoe UI',
			sans-serif;
	}

	.url-form__field {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.url-form__label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
	}

	.url-form__hint {
		font-size: 0.7rem;
		font-weight: 300;
		color: #777;
	}

	.url-form__textarea {
		box-sizing: border-box;
		width: 100%;
		resize: vertical;
		min-height: 6rem;
		padding: 0.85rem 1rem;
		font: inherit;
		font-size: 0.95rem;
		line-height: 1.5;
		color: var(--accent);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		transition:
			border-color 200ms ease,
			box-shadow 200ms ease,
			background 200ms ease;
	}

	.url-form__textarea::placeholder {
		color: #aaa;
	}

	.url-form__textarea:focus-visible {
		outline: none;
		background: #fff;
		border-color: var(--accent);
		box-shadow: 0 0 0 3px rgba(26, 26, 26, 0.12);
	}

	.url-form__textarea:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.url-form__submit {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.9rem 1.5rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff;
		background: var(--accent);
		border: none;
		border-radius: 0.75rem;
		cursor: pointer;
		transition:
			transform 150ms ease,
			opacity 200ms ease,
			box-shadow 200ms ease;
	}

	.url-form__submit:hover:not(:disabled) {
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
		transform: translateY(-1px);
	}

	.url-form__submit:active:not(:disabled) {
		transform: translateY(0);
	}

	.url-form__submit:focus-visible {
		outline: 3px solid var(--accent);
		outline-offset: 3px;
	}

	.url-form__submit:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.url-form__spinner {
		width: 0.9rem;
		height: 0.9rem;
		border: 2px solid rgba(255, 255, 255, 0.4);
		border-top-color: #fff;
		border-radius: 50%;
		animation: url-form-spin 700ms linear infinite;
	}

	.url-form__error {
		width: 100%;
		margin: 0;
		padding: 0.75rem 1rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--error);
		background: rgba(192, 57, 43, 0.08);
		border-left: 3px solid var(--error);
		border-radius: 0.5rem;
	}

	.url-form__row {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.url-form__hint--warn {
		font-weight: 600;
		color: var(--error);
	}

	.url-form__file {
		position: relative;
		font-size: 0.75rem;
		text-decoration: underline;
		cursor: pointer;
	}

	.url-form__file input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.url-form__file:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.url-form__check {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		font-size: 0.8rem;
		line-height: 1.4;
		cursor: pointer;
	}

	.url-form__check input {
		margin: 0.15rem 0 0;
		accent-color: var(--accent);
	}

	.url-form__buttons {
		display: flex;
		gap: 0.5rem;
	}

	.url-form__stop {
		padding: 0.9rem 1.5rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--accent);
		background: transparent;
		border: 1px solid var(--accent);
		border-radius: 0.75rem;
		cursor: pointer;
	}

	.url-form__notice {
		margin: 0;
		font-size: 0.8rem;
		color: #2c6e2f;
	}

	@keyframes url-form-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (min-width: 48rem) {
		.url-form {
			gap: 1.25rem;
		}

		.url-form__submit {
			width: auto;
			padding-inline: 2.5rem;
		}

		.url-form__label {
			font-size: 0.8rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.url-form__textarea,
		.url-form__submit {
			transition: none;
		}
		.url-form__submit:hover:not(:disabled) {
			transform: none;
		}
		.url-form__spinner {
			animation-duration: 1.6s;
		}
	}
</style>
