<script lang="ts">
	import { tick } from 'svelte';
	import { copyText } from '$lib/files';
	import { useI18n } from '$lib/i18n';

	/*
	 * "Share": first a link to the list as it is, to keep changing it (the address, a short link, or the phone's
	 * own sharing); then publishing the list as a page of its own with a title, which nobody can change
	 * (POST /api/lists, lib/server/lists.ts). A native <dialog>: it keeps the focus inside, Escape closes it,
	 * and the focus goes back to the button.
	 */

	interface Props {
		/** The list as it stands (after any edits) */
		urls: string[];
		view: string;
		lang: string;
		/** The address of the list (it holds the whole list) */
		link: string;
		/** Not while a query fills the list */
		disabled?: boolean;
		/** Copies the address of the list */
		oncopylink: () => void;
		/** Makes a short link and copies it */
		onshortlink: () => void;
	}

	let { urls, view, lang, link, disabled = false, oncopylink, onshortlink }: Props = $props();

	const i18n = useI18n();
	const MAX_TITLE = 80;
	const MAX_DESCRIPTION = 300;

	let dialog = $state<HTMLDialogElement>();
	let firstChoice = $state<HTMLButtonElement>();
	let linkField = $state<HTMLInputElement>();
	let title = $state('');
	let description = $state('');
	let publishing = $state(false);
	let error = $state('');
	let published = $state('');
	let copied = $state(false);
	/** Phones (and some browsers) offer their own sharing: messengers, mail, ... */
	let canSend = $state(false);

	async function open() {
		error = '';
		published = '';
		copied = false;
		canSend = typeof navigator.share === 'function';
		dialog?.showModal();
		await tick();
		firstChoice?.focus();
	}

	function close() {
		dialog?.close();
	}

	/** The system's share sheet; closing it without sending is not an error */
	async function send(url: string, name: string) {
		try {
			await navigator.share({ title: name, url });
		} catch {
			// cancelled
		}
	}

	async function publish(event: SubmitEvent) {
		event.preventDefault();
		if (publishing || !title.trim()) return;
		publishing = true;
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
			published = new URL(path, location.href).href;
			await tick();
			linkField?.select();
		} catch (err) {
			error = i18n.t(
				(err as Error).message === 'tooMany' ? 'shareDialog.tooMany' : 'shareDialog.failed'
			);
		} finally {
			publishing = false;
		}
	}

	async function copyPublished() {
		await copyText(published);
		copied = true;
	}

	function linkOnly(action: () => void) {
		close();
		action();
	}
</script>

<button type="button" class="share__button" {disabled} onclick={open}
	>{i18n.t('shareDialog.button')}</button
>

<dialog class="share" bind:this={dialog} aria-labelledby="share-heading">
	<div class="share__head">
		<h2 id="share-heading" class="share__heading">{i18n.t('shareDialog.heading')}</h2>
		<button
			type="button"
			class="share__close"
			aria-label={i18n.t('shareDialog.close')}
			onclick={close}>×</button
		>
	</div>

	<section class="share__part" aria-labelledby="share-link">
		<h3 id="share-link" class="share__subheading">{i18n.t('shareDialog.linkHeading')}</h3>
		<p class="share__hint">{i18n.t('shareDialog.linkHint')}</p>
		<div class="share__choices">
			<button
				type="button"
				class="share__choice"
				bind:this={firstChoice}
				onclick={() => linkOnly(oncopylink)}
				>{i18n.t('toolbar.copyLink')}<small>{i18n.t('toolbar.copyLinkHint')}</small></button
			>
			<button type="button" class="share__choice" onclick={() => linkOnly(onshortlink)}
				>{i18n.t('toolbar.shortLink')}<small>{i18n.t('toolbar.shortLinkHint')}</small></button
			>
			{#if canSend}
				<button
					type="button"
					class="share__choice"
					onclick={() => {
						close();
						send(link, 'urlhub');
					}}>{i18n.t('shareDialog.send')}<small>{i18n.t('shareDialog.sendHint')}</small></button
				>
			{/if}
		</div>
	</section>

	<section class="share__part" aria-labelledby="share-page">
		<h3 id="share-page" class="share__subheading">{i18n.t('shareDialog.pageHeading')}</h3>
		{#if published}
			<p class="share__done" role="status">{i18n.t('shareDialog.published')}</p>
			<div class="share__link">
				<input
					bind:this={linkField}
					class="share__field"
					readonly
					value={published}
					aria-label={i18n.t('shareDialog.pageLink')}
				/>
				<button type="button" class="share__action" onclick={copyPublished}
					>{copied ? i18n.t('shareDialog.copied') : i18n.t('shareDialog.copy')}</button
				>
				{#if canSend}
					<button type="button" class="share__action" onclick={() => send(published, title)}
						>{i18n.t('shareDialog.send')}</button
					>
				{/if}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the address the server gave -->
				<a class="share__action share__action--primary" href={published}
					>{i18n.t('shareDialog.open')}</a
				>
			</div>
		{:else}
			<form class="share__form" onsubmit={publish}>
				<div class="share__label">
					<label for="share-title">{i18n.t('shareDialog.titleLabel')}</label>
					<input
						id="share-title"
						bind:value={title}
						class="share__field"
						required
						maxlength={MAX_TITLE}
						aria-describedby="share-title-count"
					/>
					<small id="share-title-count" class="share__count"
						>{i18n.t('shareDialog.count', { count: title.length, max: MAX_TITLE })}</small
					>
				</div>
				<div class="share__label">
					<label for="share-description">{i18n.t('shareDialog.descriptionLabel')}</label>
					<textarea
						id="share-description"
						bind:value={description}
						class="share__field"
						rows="2"
						maxlength={MAX_DESCRIPTION}
						aria-describedby="share-description-count"></textarea>
					<small id="share-description-count" class="share__count"
						>{i18n.t('shareDialog.count', {
							count: description.length,
							max: MAX_DESCRIPTION
						})}</small
					>
				</div>
				{#if error}
					<p class="share__error" role="alert">{error}</p>
				{/if}
				<button
					type="submit"
					class="share__action share__action--primary"
					disabled={publishing || !title.trim()}
					>{publishing ? i18n.t('shareDialog.publishing') : i18n.t('shareDialog.publish')}</button
				>
			</form>
		{/if}
		{#if !published}
			<p class="share__hint">{i18n.t('shareDialog.pageHint')}</p>
		{/if}
	</section>
</dialog>

<style>
	.share__button {
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

	.share__button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.share__button:focus-visible,
	.share__close:focus-visible,
	.share__action:focus-visible,
	.share__choice:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.share {
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

	.share::backdrop {
		background: rgba(0, 0, 0, 0.45);
	}

	.share__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.share__heading {
		margin: 0;
		font-size: 1.15rem;
	}

	.share__close {
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

	.share__part {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-block: 0.75rem;
	}

	.share__part + .share__part {
		border-top: 1px solid var(--border-soft);
	}

	.share__subheading {
		margin: 0;
		font-size: 0.95rem;
	}

	.share__hint,
	.share__done,
	.share__error {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.45;
		color: var(--ink-3);
	}

	.share__done {
		color: var(--success);
		font-weight: 600;
	}

	.share__error {
		color: var(--error);
	}

	.share__form {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.share__label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8rem;
		font-weight: 600;
	}

	.share__field {
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

	.share__count {
		align-self: flex-end;
		font-weight: 400;
		color: var(--muted);
	}

	.share__link {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.share__link .share__field {
		flex: 1 1 14rem;
	}

	.share__action {
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

	.share__form .share__action {
		align-self: flex-start;
	}

	.share__action--primary {
		color: var(--on-accent);
		background: var(--accent);
		border-color: var(--accent);
	}

	.share__action:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.share__choices {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		gap: 0.5rem;
	}

	.share__choice {
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

	.share__choice small {
		display: block;
		margin-top: 0.15rem;
		font-weight: 400;
		color: var(--muted);
	}
</style>
