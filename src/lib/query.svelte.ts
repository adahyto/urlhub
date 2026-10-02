import type { ApiUrl, Row } from './types';

export const MAX_URLS = 200;

/**
 * Roughly how many links the text has, for the form's hint before sending. ldb-api finds the exact list (it
 * also drops punctuation stuck to the end and splits glued links); the results always follow its list.
 */
export const roughCount = (text: string): number => {
	const found: string[] = text.match(/https?:\/\/[^\s,;<>"'`]+/gi) ?? [];
	return found.filter((url, i) => found.indexOf(url) === i).length;
};

const waiting = (url: string): Row => ({
	url,
	type: 'page',
	title: '',
	desc: '',
	ogImg: { ogImg: '', ogImgAlt: '' },
	pending: true
});

/**
 * One query to ldb-api through this app's /api/json: the text goes as typed, ldb-api answers link by link
 * (NDJSON) and its first line lists the links found, so the rows appear at once in its order and fill in.
 */
export class LinkQuery {
	rows = $state<Row[]>([]);
	loading = $state(false);
	error = $state<string | null>(null);
	/** Whether the rows hold advanced details */
	advanced = $state(false);
	ready = $derived(this.rows.filter((r) => !r.pending).length);
	failed = $derived(this.rows.filter((r) => !r.pending && r.error).length);

	#controller: AbortController | null = null;

	constructor(private readonly endpoint = '/api/json') {}

	/**
	 * Fetches the details of the links in the text. onList gets ldb-api's list of links as soon as it is known
	 * (to put it in the address). A new run or stop() cancels the one in progress.
	 */
	async run(text: string, advanced: boolean, onList?: (urls: string[]) => void): Promise<void> {
		this.#controller?.abort();
		const controller = new AbortController();
		this.#controller = controller;
		this.loading = true;
		this.error = null;
		this.rows = [];
		this.advanced = advanced;
		try {
			const res = await fetch(this.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
				body: JSON.stringify({ text, advanced }),
				signal: controller.signal
			});
			if (/ndjson/.test(res.headers.get('content-type') ?? '')) {
				await this.#read(res, onList);
			} else {
				// Errors (limits) come as one JSON, and so would a whole answer from an API that does not stream
				const data = await res.json().catch(() => null);
				if (!res.ok || !Array.isArray(data?.urls)) {
					throw new Error(
						data?.error || `The link service answered with an error (${res.status}).`
					);
				}
				this.rows = data.urls as ApiUrl[];
				onList?.(this.rows.map((r) => r.url));
			}
			if (!this.rows.length) this.error = 'No links found. Links start with http:// or https://.';
		} catch (err) {
			if (controller.signal.aborted) return;
			// Rows already filled stay; the rest say they were not fetched
			this.#settlePending('not fetched');
			if (!this.ready) this.rows = [];
			this.error = err instanceof Error ? err.message : 'Something went wrong.';
		} finally {
			if (this.#controller === controller) {
				this.loading = false;
				this.#controller = null;
			}
		}
	}

	/** Stops the query in progress; the links not ready by then are marked as stopped */
	stop(): void {
		if (!this.#controller) return;
		this.#controller.abort();
		this.#controller = null;
		this.loading = false;
		this.#settlePending('stopped');
	}

	#settlePending(error: string): void {
		this.rows = this.rows.map((r) => (r.pending ? { ...r, pending: false, error } : r));
	}

	async #read(res: Response, onList?: (urls: string[]) => void): Promise<void> {
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
				if (Array.isArray(message.urls)) {
					this.rows = message.urls.map(waiting);
					onList?.(message.urls);
				}
				if (message.result) this.rows[message.index] = message.result;
				if (message.error) throw new Error(message.error);
				if (message.done) done = true;
			}
		}
		if (!done) throw new Error('The answer was cut off. Fetch again to complete the list.');
	}
}

/** The finished rows as ldb-api would answer them, for copying and downloading */
export const asJson = (rows: Row[]): string =>
	JSON.stringify({ urls: rows.filter((r) => !r.pending) }, null, 2);
