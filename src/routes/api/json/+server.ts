import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// ldb-api is called from this server, so the browser needs no CORS and never sees its address.
// In Docker LDB_API_URL points at it through the host (docker-compose.yaml); `npm run dev` uses the public one.
const apiUrl = () => env.LDB_API_URL || 'http://51.75.116.68:84/json';

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
		response = await fetch(apiUrl(), {
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
	return new Response(response.body, {
		status: response.status,
		headers: {
			'content-type': response.headers.get('content-type') ?? 'application/json',
			'cache-control': 'no-store'
		}
	});
};
