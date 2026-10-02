import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// ldb-api's /json/links, next to its /json (src/routes/api/json/+server.ts says where that is)
const linksUrl = () => `${env.LDB_API_URL || 'http://51.75.116.68:84/json'}/links`;
const MAX_TEXT = 100_000;

/**
 * POST { text } -> { total, urls }: the links ldb-api finds in a text, without reading them; the field shows only
 * these when a .txt file is added
 */
export const POST: RequestHandler = async ({ request, fetch, getClientAddress }) => {
	const body = await request.json().catch(() => null);
	if (typeof body?.text !== 'string')
		return json({ error: 'Send { "text": "..." }.' }, { status: 400 });
	if (body.text.length > MAX_TEXT) {
		return json(
			{ error: `The text is too long (at most ${MAX_TEXT} characters).` },
			{ status: 413 }
		);
	}
	try {
		const response = await fetch(linksUrl(), {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				// ldb-api limits requests per visitor; without this every urlhub visitor would share one limit
				'x-forwarded-for': getClientAddress()
			},
			body: JSON.stringify({ text: body.text }),
			signal: AbortSignal.timeout(10_000)
		});
		return json(await response.json(), { status: response.status });
	} catch {
		return json({ error: 'The preview server cannot be reached.' }, { status: 502 });
	}
};
