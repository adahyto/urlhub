<script lang="ts">
	import { page } from '$app/state';
	import type { ApiResponse, TileUrl } from '$lib/types';
    import { goto } from '$app/navigation';

	interface Props {
		endpoint?: string;
		urls?: TileUrl[];
		onResults?: (urls: TileUrl[]) => void;
		onError?: (message: string) => void;
		autoFetch?: boolean;
	}

	let {
		endpoint = 'http://51.75.116.68:84/json',
		urls = $bindable([]),
		onResults,
		onError,
		autoFetch = false
	}: Props = $props();

	function tokenize(raw: string): string[] {
		return raw
			.replace(/%20/gi, ' ')
			.split(/(?=https?:\/\/)/i)
			.map((s) => s.replace(/^[\s,;-]+|[\s,;-]+$/g, '').trim())
			.filter(Boolean);
	}

	function urlsFromQuery(): string {
		return tokenize(page.url.searchParams.get('urls') ?? '').join('\n');
	}

	let input = $state(urlsFromQuery());
	let loading = $state(false);
	let error = $state<string | null>(null);

	function toTileUrls(data: ApiResponse): TileUrl[] {
		return data.urls.map((item) => {
			const raw = item.ogImg?.ogImg ?? '';
			let src = '';
			if (raw) {
				try {
					src = new URL(raw, item.url).href;
				} catch {
					src = raw;
				}
			}
			return {
				url: item.url,
				title: item.title,
				desc: item.desc,
				ogImg: { src, alt: item.ogImg?.ogImgAlt ?? '' }
			};
		});
	}

	async function fetchUrls() {
	const list = tokenize(input);
	if (list.length === 0) {
		error = 'Please enter at least one URL.';
		onError?.(error);
		return;
	}

	const urlsParam = list.map((u) => encodeURI(u)).join('-');
	goto(`${page.url.pathname}?urls=${urlsParam}`, {
		replaceState: true,
		keepFocus: true,
		noScroll: true
	});

	loading = true;
	error = null;

	try {
		const encoded = list.map((u) => encodeURI(u)).join('%20');
		const requestUrl = `${endpoint}?urls=${encoded}`;

		const res = await fetch(requestUrl, { headers: { Accept: 'application/json' } });
		if (!res.ok) throw new Error(`Request failed with status ${res.status}`);

		const data: ApiResponse = await res.json();
		const result = toTileUrls(data);

		urls = result;
		onResults?.(result);
	} catch (err) {
		error = err instanceof Error ? err.message : 'Something went wrong.';
		urls = [];
		onError?.(error);
	} finally {
		loading = false;
	}
}
	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		fetchUrls();
	}

	let didAutoFetch = false;
	$effect(() => {
		if (autoFetch && !didAutoFetch && input.trim()) {
			didAutoFetch = true;
			fetchUrls();
		}
	});
</script>
<form onsubmit={handleSubmit} class="url-form" novalidate>
	<div class="url-form__field">
		<label class="url-form__label" for="urls">Enter URLs</label>
		<span class="url-form__hint">Separate with spaces, commas, or new lines</span>

		<textarea
			id="urls"
			class="url-form__textarea"
			bind:value={input}
			rows="4"
			placeholder="https://ogp.me&#10;https://svelte.dev"
			disabled={loading}
		></textarea>
	</div>

	<button type="submit" class="url-form__submit" disabled={loading}>
		{#if loading}
			<span class="url-form__spinner" aria-hidden="true"></span>
			<span>Loading…</span>
		{:else}
			<span>Fetch</span>
		{/if}
	</button>

	{#if error}
		<p class="url-form__error" role="alert">{error}</p>
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
		font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
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
			align-self: flex-start;
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