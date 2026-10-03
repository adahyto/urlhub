import { json } from '@sveltejs/kit';
import { withImages } from '$lib/server/images';
import { ldbApiUrl } from '$lib/server/ldb';
import type { ApiUrl } from '$lib/types';
import type { RequestHandler } from './$types';

// Each result gets the addresses of its pictures through /img (src/lib/server/images.ts), line by line as the
// NDJSON stream goes past, so the browser never fetches pictures from other sites
function addImagesToStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();
	let rest = '';
	const line = (text: string) => {
		if (!text.trim()) return '';
		try {
			const message = JSON.parse(text);
			if (message?.result) message.result = withImages(message.result as ApiUrl);
			return `${JSON.stringify(message)}\n`;
		} catch {
			return `${text}\n`;
		}
	};
	return body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				const lines = (rest + decoder.decode(chunk, { stream: true })).split('\n');
				rest = lines.pop() ?? '';
				const out = lines.map(line).join('');
				if (out) controller.enqueue(encoder.encode(out));
			},
			flush(controller) {
				const out = line(rest + decoder.decode());
				if (out) controller.enqueue(encoder.encode(out));
			}
		})
	);
}

// Plenty for 200 links with text around them; ldb-api itself refuses more than 200 links (413)
const MAX_TEXT = 100_000;

/**
 * POST { text: "links as typed", advanced?: boolean } (or the older { urls: string[] }) -> ldb-api's answer,
 * passed on as it comes: link by link (NDJSON) when the browser asks for it with Accept: application/x-ndjson,
 * otherwise { urls: [...] }; errors are { error }. ldb-api finds the links in the text.
 */
export const POST: RequestHandler = async ({ request, fetch, getClientAddress }) => {
	const body = await request.json().catch(() => null);
	const text = Array.isArray(body?.urls) ? body.urls.join('\n') : body?.text;
	if (
		typeof text !== 'string' ||
		(Array.isArray(body?.urls) && !body.urls.every((u: unknown) => typeof u === 'string'))
	) {
		return json({ error: 'Send { "text": "links..." }.' }, { status: 400 });
	}
	if (text.length > MAX_TEXT) {
		return json(
			{ error: `The text is too long (at most ${MAX_TEXT} characters).` },
			{ status: 413 }
		);
	}

	let response: Response;
	try {
		response = await fetch(ldbApiUrl(), {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: request.headers.get('accept') ?? 'application/json',
				// ldb-api limits links per visitor; without this every urlhub visitor would share one limit
				'x-forwarded-for': getClientAddress()
			},
			body: JSON.stringify({ text, advanced: body.advanced === true }),
			// ldb-api reads up to 200 links, 5 at a time (2 per site), 10 s each at worst
			signal: AbortSignal.timeout(300_000)
		});
	} catch {
		return json(
			{ error: 'The link service cannot be reached. Try again in a moment.' },
			{ status: 502 }
		);
	}
	const type = response.headers.get('content-type') ?? 'application/json';
	const headers = { 'content-type': type, 'cache-control': 'no-store' };
	if (/ndjson/.test(type) && response.body) {
		return new Response(addImagesToStream(response.body), { status: response.status, headers });
	}
	// a plain JSON answer: { urls: [...] } or { error }
	const answer = await response.json().catch(() => null);
	if (Array.isArray(answer?.urls))
		answer.urls = answer.urls.map((r: ApiUrl | string) =>
			typeof r === 'object' && r ? withImages(r) : r
		);
	return new Response(JSON.stringify(answer ?? { error: 'Bad answer from the link service.' }), {
		status: response.status,
		headers
	});
};
