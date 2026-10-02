<script lang="ts">
	import type { Snippet } from 'svelte';
	import { MAX_URLS, roughCount } from '$lib/query.svelte';
	import { useI18n } from '$lib/i18n';

	const i18n = useI18n();

	interface Props {
		/** The text in the field: links as typed, ldb-api finds them */
		text: string;
		advanced: boolean;
		loading: boolean;
		ready: number;
		total: number;
		/** Already in the interface language */
		error: string | null;
		onsubmit: () => void;
		onstop: () => void;
		/** Fills the field with the example links and fetches them */
		onexample: () => void;
		/** The advanced option was switched (the page shows the table for it) */
		onadvanced?: (on: boolean) => void;
		/** Next to the Fetch button: the recent queries menu */
		actions?: Snippet;
	}

	let {
		text = $bindable(),
		advanced = $bindable(),
		loading,
		ready,
		total,
		error,
		onsubmit,
		onstop,
		onexample,
		onadvanced,
		actions
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

	// The file is read here, in the browser; ldb-api finds the links in it (/api/links) and only those join the
	// field. Without the server the whole text goes in: the preview finds the links in it anyway.
	async function addFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const content = await file.text();
		let added = content.trim();
		let count = roughCount(content);
		try {
			const res = await fetch('/api/links', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ text: content })
			});
			if (res.ok) {
				const found: { urls: string[] } = await res.json();
				added = found.urls.join('\n');
				count = found.urls.length;
			}
		} catch {
			// keep the whole text
		}
		text = [text.trim(), added].filter(Boolean).join('\n');
		notice = count
			? i18n.t('form.fileAdded', { count, file: file.name })
			: i18n.t('form.fileEmpty', { file: file.name });
		setTimeout(() => (notice = ''), 4000);
	}
</script>

<form onsubmit={submit} class="url-form" novalidate>
	<div class="url-form__field">
		<label class="url-form__label" for="urls">{i18n.t('form.label')}</label>
		<textarea
			id="urls"
			class="url-form__textarea"
			bind:value={text}
			{onkeydown}
			rows="4"
			spellcheck="false"
			placeholder={i18n.t('form.placeholder')}
			aria-describedby="urls-hint"
			disabled={loading}></textarea>
		<span id="urls-hint" class="sr-only">{i18n.t('form.hint')}</span>
	</div>

	<div class="url-form__row">
		<span class="url-form__count" class:url-form__count--warn={count > MAX_URLS}>
			{i18n.t('form.links', { count })}{count > MAX_URLS
				? i18n.t('form.atMost', { max: MAX_URLS })
				: ''}
		</span>
		<label class="url-form__file">
			{i18n.t('form.addFile')}
			<input type="file" accept=".txt,text/plain" onchange={addFile} disabled={loading} />
		</label>
		{#if !text.trim() && !loading}
			<button type="button" class="url-form__link" onclick={onexample}
				>{i18n.t('form.example')}</button
			>
		{/if}
		<label class="url-form__check">
			<input
				type="checkbox"
				bind:checked={advanced}
				onchange={() => onadvanced?.(advanced)}
				disabled={loading}
				aria-describedby="advanced-hint"
			/>
			<span>{i18n.t('form.advancedShort')}</span>
		</label>
		<span id="advanced-hint" class="sr-only">{i18n.t('form.advanced')}</span>

		<span class="url-form__spacer"></span>

		{@render actions?.()}
		{#if loading}
			<button type="button" class="url-form__stop" onclick={onstop}>{i18n.t('form.stop')}</button>
		{/if}
		<button type="submit" class="url-form__submit" disabled={loading}>
			{#if loading}
				<span class="url-form__spinner" aria-hidden="true"></span>
				<span>{i18n.t('form.loading', { ready, total })}</span>
			{:else}
				<span>{i18n.t('form.fetch')}</span>
			{/if}
		</button>
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
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
	}

	.url-form__field {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.url-form__label {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink);
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
		color: var(--ink);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		transition:
			border-color 200ms ease,
			box-shadow 200ms ease;
	}

	.url-form__textarea::placeholder {
		color: var(--muted);
		opacity: 1;
	}

	.url-form__textarea:focus-visible {
		outline: none;
		background: var(--surface);
		border-color: var(--accent);
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.url-form__textarea:disabled {
		opacity: 0.6;
	}

	.url-form__row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 1rem;
		font-size: 0.8rem;
	}

	.url-form__count {
		color: var(--muted);
	}

	.url-form__count--warn {
		font-weight: 600;
		color: var(--error);
	}

	.url-form__file,
	.url-form__link {
		position: relative;
		padding: 0;
		font: inherit;
		color: var(--ink);
		text-decoration: underline;
		background: none;
		border: 0;
		cursor: pointer;
	}

	.url-form__file input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}

	.url-form__file:focus-within,
	.url-form__link:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.url-form__check {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		cursor: pointer;
	}

	.url-form__check input {
		margin: 0;
		accent-color: var(--accent);
	}

	.url-form__spacer {
		flex: 1;
	}

	.url-form__submit,
	.url-form__stop {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		min-height: 2.75rem;
		padding: 0 1.75rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		border-radius: 0.75rem;
		cursor: pointer;
	}

	.url-form__submit {
		color: var(--on-accent);
		background: var(--accent);
		border: 1px solid var(--accent);
		transition:
			transform 150ms ease,
			box-shadow 200ms ease;
	}

	.url-form__submit:hover:not(:disabled) {
		box-shadow: 0 6px 18px var(--shadow);
		transform: translateY(-1px);
	}

	.url-form__submit:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.url-form__stop {
		color: var(--ink);
		background: transparent;
		border: 1px solid var(--accent);
	}

	.url-form__submit:focus-visible,
	.url-form__stop:focus-visible {
		outline: 3px solid var(--ink);
		outline-offset: 3px;
	}

	.url-form__spinner {
		width: 0.9rem;
		height: 0.9rem;
		border: 2px solid color-mix(in srgb, var(--on-accent) 40%, transparent);
		border-top-color: var(--on-accent);
		border-radius: 50%;
		animation: url-form-spin 700ms linear infinite;
	}

	.url-form__error {
		margin: 0;
		padding: 0.75rem 1rem;
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--error);
		background: var(--error-bg);
		border-left: 3px solid var(--error);
		border-radius: 0.5rem;
	}

	.url-form__notice {
		margin: 0;
		font-size: 0.8rem;
		color: var(--success);
	}

	@keyframes url-form-spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Phones: the buttons take a row of their own, Fetch the widest part of it */
	@media (max-width: 40rem) {
		.url-form__spacer {
			flex-basis: 100%;
		}

		.url-form__submit {
			flex: 1;
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
