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

/** What went wrong with a whole query; the page says it in the interface language (lib/i18n/messages.ts) */
export type QueryError =
	| { kind: 'empty' }
	| { kind: 'cutoff' }
	| { kind: 'network' }
	| { kind: 'http'; status: number; message: string };

class QueryFailure extends Error {
	constructor(readonly error: QueryError) {
		super(error.kind);
	}
}

const failure = (err: unknown): QueryError =>
	err instanceof QueryFailure ? err.error : { kind: 'network' };

/**
 * "blocked": the site refuses servers (shops behind DataDome, Akamai, Cloudflare). Not a failure the visitor can fix
 * or retry: such rows keep a title from their address and are counted apart.
 */
export const isBlocked = (r: Row) => r.error === 'blocked';
export const isFailed = (r: Row) => !r.pending && !!r.error && !isBlocked(r);

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
	error = $state<QueryError | null>(null);
	/** Whether the rows hold advanced details */
	advanced = $state(false);
	ready = $derived(this.rows.filter((r) => !r.pending).length);
	failed = $derived(this.rows.filter(isFailed).length);
	blocked = $derived(this.rows.filter(isBlocked).length);

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
				await this.#read(
					res,
					(urls) => {
						this.rows = urls.map(waiting);
						onList?.(urls);
					},
					(index, result) => (this.rows[index] = result)
				);
			} else {
				// Errors (limits) come as one JSON, and so would a whole answer from an API that does not stream
				const data = await res.json().catch(() => null);
				if (!res.ok || !Array.isArray(data?.urls)) {
					throw new QueryFailure({ kind: 'http', status: res.status, message: data?.error ?? '' });
				}
				this.rows = data.urls as ApiUrl[];
				onList?.(this.rows.map((r) => r.url));
			}
			if (!this.rows.length) this.error = { kind: 'empty' };
		} catch (err) {
			if (controller.signal.aborted) return;
			// Rows already filled stay; the rest say they were not fetched
			this.#settlePending('not fetched');
			if (!this.ready) this.rows = [];
			this.error = failure(err);
		} finally {
			if (this.#controller === controller) {
				this.loading = false;
				this.#controller = null;
			}
		}
	}

	/**
	 * Asks again for the links that failed (ldb-api does not keep failures, so they are read anew); their rows
	 * wait in place and fill in as before, the others stay as they are
	 */
	async retryFailed(): Promise<void> {
		if (this.loading) return;
		// Where each failed link sits in the list (a plain object: nothing here needs to be reactive)
		const positions: Record<string, number> = {};
		this.rows.forEach((r, i) => {
			if (isFailed(r)) positions[r.url] = i;
		});
		const urls = Object.keys(positions);
		if (!urls.length) return;
		const controller = new AbortController();
		this.#controller = controller;
		this.loading = true;
		this.error = null;
		for (const url of urls) this.rows[positions[url]] = waiting(url);
		const place = (result: ApiUrl) => {
			const i = positions[result.url];
			if (i !== undefined) this.rows[i] = result;
		};
		try {
			const res = await fetch(this.endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/x-ndjson' },
				body: JSON.stringify({ text: urls.join('\n'), advanced: this.advanced }),
				signal: controller.signal
			});
			if (/ndjson/.test(res.headers.get('content-type') ?? '')) {
				await this.#read(res, undefined, (_, result) => place(result));
			} else {
				const data = await res.json().catch(() => null);
				if (!res.ok || !Array.isArray(data?.urls)) {
					throw new QueryFailure({ kind: 'http', status: res.status, message: data?.error ?? '' });
				}
				(data.urls as ApiUrl[]).forEach(place);
			}
		} catch (err) {
			if (controller.signal.aborted) return;
			this.#settlePending('not fetched');
			this.error = failure(err);
		} finally {
			if (this.#controller === controller) {
				this.loading = false;
				this.#controller = null;
			}
		}
	}

	// Editing the list (not while a query fills it: results arrive by position)

	/** Takes a link out of the list; returns it with its place, for undo */
	remove(url: string): { row: Row; index: number } | null {
		const index = this.rows.findIndex((r) => r.url === url);
		if (index < 0 || this.loading) return null;
		const row = this.rows[index];
		this.rows = this.rows.filter((_, i) => i !== index);
		return { row, index };
	}

	/** Puts a removed link back where it was */
	restore(row: Row, index: number): void {
		if (this.loading || this.rows.some((r) => r.url === row.url)) return;
		this.rows = [...this.rows.slice(0, index), row, ...this.rows.slice(index)];
	}

	/** Moves a link by delta places (-1 earlier, 1 later), or to the place of another link */
	move(url: string, to: number | { before: string }): void {
		if (this.loading) return;
		const from = this.rows.findIndex((r) => r.url === url);
		if (from < 0) return;
		const target =
			typeof to === 'number' ? from + to : this.rows.findIndex((r) => r.url === to.before);
		if (target < 0 || target >= this.rows.length || target === from) return;
		const rows = [...this.rows];
		const [row] = rows.splice(from, 1);
		rows.splice(target, 0, row);
		this.rows = rows;
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

	/** Reads ldb-api's NDJSON answer: onUrls gets the list of links found (first line), onResult each result */
	async #read(
		res: Response,
		onUrls: ((urls: string[]) => void) | undefined,
		onResult: (index: number, result: ApiUrl) => void
	): Promise<void> {
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
				if (Array.isArray(message.urls)) onUrls?.(message.urls);
				if (message.result) onResult(message.index, message.result);
				if (message.error) {
					throw new QueryFailure({ kind: 'http', status: 500, message: message.error });
				}
				if (message.done) done = true;
			}
		}
		if (!done) throw new QueryFailure({ kind: 'cutoff' });
	}
}

/** The finished rows as ldb-api would answer them, for copying and downloading */
export const asJson = (rows: Row[]): string =>
	JSON.stringify({ urls: rows.filter((r) => !r.pending) }, null, 2);

const CSV_COLUMNS: [string, (r: Row) => unknown][] = [
	['url', (r) => r.url],
	['final_url', (r) => r.finalUrl],
	['status', (r) => r.status],
	['type', (r) => r.type],
	['service', (r) => r.service],
	['site', (r) => r.siteName],
	['title', (r) => r.title],
	['description', (r) => r.desc],
	['author', (r) => r.author || r.channel],
	['published', (r) => r.published],
	['duration', (r) => r.duration],
	['language', (r) => r.lang],
	['image', (r) => r.ogImg?.ogImg],
	['stars', (r) => r.extra?.stars],
	['response_ms', (r) => r.responseMs],
	['error', (r) => r.error],
	['seo_warnings', (r) => (r.warnings ?? []).map((w) => w.code).join('; ')]
];

const cell = (value: unknown): string => {
	const text = value === null || value === undefined ? '' : String(value);
	return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * The finished rows as CSV, one link per line. Starts with a byte order mark so that Excel reads the UTF-8
 * (Polish letters) right.
 */
export const asCsv = (rows: Row[]): string =>
	'\uFEFF' +
	[
		CSV_COLUMNS.map(([name]) => name),
		...rows.filter((r) => !r.pending).map((r) => CSV_COLUMNS.map(([, get]) => get(r)))
	]
		.map((line) => line.map(cell).join(','))
		.join('\r\n');
