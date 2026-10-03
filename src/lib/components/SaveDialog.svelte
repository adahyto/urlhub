<script lang="ts">
	import { tick } from 'svelte';
	import { copyText } from '$lib/files';
	import { useI18n } from '$lib/i18n';

	/*
	 * "Save": the list as a page of its own with a title, which nobody can change (POST /api/lists,
	 * lib/server/lists.ts), or only a link to the list as it is, to change further (the address, a short link).
	 * A native <dialog>: it keeps the focus inside, Escape closes it, and the focus goes back to the button.
	 */

	interface Props {
		/** The list as it stands (after any edits) */
		urls: string[];
		view: string;
		lang: string;
		/** Not while a query fills the list */
		disabled?: boolean;
		/** Copies the address of the list (it holds the whole list) */
		oncopylink: () => void;
		/** Makes a short link and copies it */
		onshortlink: () => void;
	}

	let { urls, view, lang, disabled = false, oncopylink, onshortlink }: Props = $props();

	const i18n = useI18n();
	const MAX_TITLE = 80;
	const MAX_DESCRIPTION = 300;

	let dialog = $state<HTMLDialogElement>();
	let titleField = $state<HTMLInputElement>();
	let linkField = $state<HTMLInputElement>();
	let title = $state('');
	let description = $state('');
	let saving = $state(false);
	let error = $state('');
	let saved = $state('');
	let copied = $state(false);

	async function open() {
		error = '';
		saved = '';
		copied = false;
		dialog?.showModal();
		await tick();
		titleField?.focus();
	}

	function close() {
		dialog?.close();
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (saving || !title.trim()) return;
		saving = true;
		error = '';
		try {
			const res = await fetch('/api/lists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, description, urls, view, lang })
			});
			if (res.status === 429) throw new Error('tooMany');
			if (!res.ok) throw new Error('failed');
			const { path } = await res.json();
			saved = new URL(path, location.href).href;
			await tick();
			linkField?.select();
		} catch (err) {
			error = i18n.t((err as Error).message === 'tooMany' ? 'save.tooMany' : 'save.failed');
		} finally {
			saving = false;
		}
	}

	async function copySaved() {
		await copyText(saved);
		copied = true;
	}

	function linkOnly(action: () => void) {
		close();
		action();
	}
</script>

<button type="button" class="save__button" {disabled} onclick={open}>{i18n.t('save.button')}</button
>

<dialog class="save" bind:this={dialog} aria-labelledby="save-heading">
	<div class="save__head">
		<h2 id="save-heading" class="save__heading">{i18n.t('save.heading')}</h2>
		<button type="button" class="save__close" aria-label={i18n.t('save.close')} onclick={close}
			>×</button
		>
	</div>

	<section class="save__part" aria-labelledby="save-page">
		<h3 id="save-page" class="save__subheading">{i18n.t('save.asPage')}</h3>
		<p class="save__hint">{i18n.t('save.asPageHint')}</p>
		{#if saved}
			<p class="save__done" role="status">{i18n.t('save.saved')}</p>
			<div class="save__link">
				<input
					bind:this={linkField}
					class="save__field"
					readonly
					value={saved}
					aria-label={i18n.t('save.link')}
				/>
				<button type="button" class="save__action" onclick={copySaved}
					>{copied ? i18n.t('save.copied') : i18n.t('save.copy')}</button
				>
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the address the server gave -->
				<a class="save__action save__action--primary" href={saved}>{i18n.t('save.open')}</a>
			</div>
		{:else}
			<form class="save__form" onsubmit={save}>
				<div class="save__label">
					<label for="save-title">{i18n.t('save.titleLabel')}</label>
					<input
						id="save-title"
						bind:this={titleField}
						bind:value={title}
						class="save__field"
						required
						maxlength={MAX_TITLE}
						aria-describedby="save-title-count"
					/>
					<small id="save-title-count" class="save__count"
						>{i18n.t('save.count', { count: title.length, max: MAX_TITLE })}</small
					>
				</div>
				<div class="save__label">
					<label for="save-description">{i18n.t('save.descriptionLabel')}</label>
					<textarea
						id="save-description"
						bind:value={description}
						class="save__field"
						rows="2"
						maxlength={MAX_DESCRIPTION}
						aria-describedby="save-description-count"></textarea>
					<small id="save-description-count" class="save__count"
						>{i18n.t('save.count', { count: description.length, max: MAX_DESCRIPTION })}</small
					>
				</div>
				{#if error}
					<p class="save__error" role="alert">{error}</p>
				{/if}
				<button
					type="submit"
					class="save__action save__action--primary"
					disabled={saving || !title.trim()}
					>{saving ? i18n.t('save.saving') : i18n.t('save.submit')}</button
				>
			</form>
		{/if}
	</section>

	<section class="save__part" aria-labelledby="save-link">
		<h3 id="save-link" class="save__subheading">{i18n.t('save.linkOnly')}</h3>
		<p class="save__hint">{i18n.t('save.linkOnlyHint')}</p>
		<div class="save__choices">
			<button type="button" class="save__choice" onclick={() => linkOnly(oncopylink)}
				>{i18n.t('toolbar.copyLink')}<small>{i18n.t('toolbar.copyLinkHint')}</small></button
			>
			<button type="button" class="save__choice" onclick={() => linkOnly(onshortlink)}
				>{i18n.t('toolbar.shortLink')}<small>{i18n.t('toolbar.shortLinkHint')}</small></button
			>
		</div>
	</section>
</dialog>

<style>
	.save__button {
		min-height: 2.25rem;
		padding: 0.4rem 0.9rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--on-accent);
		background: var(--accent);
		border: 1px solid var(--accent);
		border-radius: 0.6rem;
		cursor: pointer;
	}

	.save__button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.save__button:focus-visible,
	.save__close:focus-visible,
	.save__action:focus-visible,
	.save__choice:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.save {
		box-sizing: border-box;
		width: min(32rem, calc(100vw - 2rem));
		max-height: calc(100dvh - 2rem);
		padding: 1.25rem;
		color: var(--ink);
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.9rem;
		box-shadow: 0 20px 48px var(--shadow);
	}

	.save::backdrop {
		background: rgba(0, 0, 0, 0.45);
	}

	.save__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.save__heading {
		margin: 0;
		font-size: 1.15rem;
	}

	.save__close {
		width: 2.25rem;
		height: 2.25rem;
		font-size: 1.3rem;
		line-height: 1;
		color: var(--ink-2);
		background: none;
		border: 0;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	.save__part {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-block: 0.75rem;
	}

	.save__part + .save__part {
		border-top: 1px solid var(--border-soft);
	}

	.save__subheading {
		margin: 0;
		font-size: 0.95rem;
	}

	.save__hint,
	.save__done,
	.save__error {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--ink-3);
	}

	.save__done {
		color: var(--success);
		font-weight: 600;
	}

	.save__error {
		color: var(--error);
	}

	.save__form {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.save__label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.save__field {
		box-sizing: border-box;
		width: 100%;
		min-height: 2.5rem;
		padding: 0.5rem 0.65rem;
		font: inherit;
		font-size: 0.9rem;
		font-weight: 400;
		color: var(--ink);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		resize: vertical;
	}

	.save__count {
		align-self: flex-end;
		font-weight: 400;
		color: var(--muted);
	}

	.save__link {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.save__link .save__field {
		flex: 1 1 14rem;
	}

	.save__action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 2.5rem;
		padding: 0.4rem 0.9rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink);
		text-decoration: none;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		cursor: pointer;
	}

	.save__form .save__action {
		align-self: flex-start;
	}

	.save__action--primary {
		color: var(--on-accent);
		background: var(--accent);
		border-color: var(--accent);
	}

	.save__action:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.save__choices {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: 0.5rem;
	}

	.save__choice {
		padding: 0.6rem 0.75rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		text-align: left;
		color: var(--ink);
		background: var(--surface-2);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		cursor: pointer;
	}

	.save__choice small {
		display: block;
		margin-top: 0.15rem;
		font-weight: 400;
		color: var(--muted);
	}
</style>
