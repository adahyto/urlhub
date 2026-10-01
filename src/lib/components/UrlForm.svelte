<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { ApiResponse, ApiUrl, TileUrl } from '$lib/types';

	interface Props {
		endpoint?: string;
		urls?: TileUrl[];
		onResults?: (urls: TileUrl[]) => void;
		onError?: (message: string) => void;
		autoFetch?: boolean;
	}

	let {
		// This app's own server passes the links on to ldb-api (src/routes/api/json/+server.ts)
		endpoint = '/api/json',
		urls = $bindable([]),
		onResults,
		onError,
		autoFetch = false
	}: Props = $props();

	const MAX_URLS = 200;
	const EXAMPLES = 'https://github.com/sveltejs, https://vite.dev, https://nodejs.org, https://docker.com';

	// Links start at "http(s)://"; anything between them (spaces, commas, the "-" of old shared links) is dropped
	function tokenize(raw: string): string[] {
		const links = raw
			.replace(/%20/gi, ' ')
			.split(/(?=https?:\/\/)/i)
			.map((s) => s.replace(/^[\s,;-]+|[\s,;-]+$/g, '').trim())
			.filter(Boolean);
		return [...new Set(links)];
	}

	const linksInAddress = page.url.searchParams.get('urls') ?? '';

	let input = $state(tokenize(linksInAddress).join('\n') || EXAMPLES);
	let loading = $state(false);
	let error = $state<string | null>(null);
	const ready = $derived(urls.filter((u) => !u.pending).length);

	function toTileUrl(item: ApiUrl): TileUrl {
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
			type: item.type ?? 'page',
			title: item.title,
			desc: item.desc,
			ogImg: { src, alt: item.ogImg?.ogImgAlt ?? '' },
			channel: item.channel ?? '',
			duration: item.duration ?? '',
			error: item.error ?? ''
		};
	}

	const waiting = (url: string): TileUrl => ({
		url,
		type: 'page',
		title: '',
		desc: '',
		ogImg: { src: '', alt: '' },
		channel: '',
		duration: '',
		error: '',
		pending: true
	});

	/** Reads ldb-api's answer line by line (NDJSON), calling onResult as each link is ready */
	async function readStream(res: Response, onResult: (index: number, item: ApiUrl) => void) {
		const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
		let buffered = '';
		let done = false;
		for (;;) {
			const chunk = await reader.read();
			if (chunk.done) break;
			buffered += chunk.value;
			const lines = buffered.split('\n');
			buffered = lines.pop() ?? '';
			for (const line of lines.filter(Boolean)) {
				const message = JSON.parse(line);
				if (message.result) onResult(message.index, message.result);
				if (message.error) throw new Error(message.error);
				if (message.done) done = true;
			}
		}
		if (!done) throw new Error('The answer was cut off. Fetch again to complete the tiles.');
	}

	function fail(message: string) {
		error = message;
		onError?.(message);
	}

	async function fetchUrls() {
		const list = tokenize(input);
		if (list.length === 0) return fail('Please enter at least one URL.');
		if (list.length > MAX_URLS) return fail(`At most ${MAX_URLS} links at once (found ${list.length}).`);

		// The address can be shared: URLSearchParams encodes "&", "?" and "#" inside the links
		const params = new URLSearchParams(page.url.searchParams);
		params.set('urls', list.join(' '));
		goto(`${page.url.pathname}?${params}`, { replaceState: true, keepFocus: true, noScroll: true });

		loading = true;
		error = null;
		// Every tile appears at once and fills in as its link is ready
		urls = list.map(waiting);
		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
				body: JSON.stringify({ urls: list })
			});
			if (/ndjson/.test(res.headers.get('content-type') ?? '')) {
				await readStream(res, (index, item) => (urls[index] = toTileUrl(item)));
			} else {
				// Errors (limits) come as one JSON, and so would a whole answer from an API that does not stream
				const data = await res.json().catch(() => null);
				if (!res.ok || !data?.urls) {
					throw new Error(data?.error || `The link service answered with an error (${res.status}).`);
				}
				urls = (data as ApiResponse).urls.map(toTileUrl);
			}
			onResults?.(urls);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Something went wrong.';
			// Tiles already filled stay; the rest say they were not fetched
			urls = urls.some((u) => !u.pending)
				? urls.map((u) => (u.pending ? { ...u, pending: false, error: 'not fetched' } : u))
				: [];
			fail(message);
		} finally {
			loading = false;
		}
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		fetchUrls();
	}

	// Only shared links (?urls=...) load by themselves; the examples wait for a click
	let didAutoFetch = false;
	$effect(() => {
		if (autoFetch && !didAutoFetch && linksInAddress && input.trim()) {
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
			disabled={loading}
		></textarea>
	</div>

	<button type="submit" class="url-form__submit" disabled={loading}>
		{#if loading}
			<span class="url-form__spinner" aria-hidden="true"></span>
			<span>Loading… {ready} / {urls.length}</span>
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