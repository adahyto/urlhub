import { json } from '@sveltejs/kit';
import { fetchDetails } from '$lib/server/ldb';
import { allowSave, saveList, validList, MAX_DESCRIPTION, MAX_TITLE } from '$lib/server/lists';
import type { RequestHandler } from './$types';

/**
 * POST { title, description?, urls, view, lang } -> { id, path: "/l/<id>" }: saves the list as a page of its own
 * (lib/server/lists.ts), with the details of its links read now by this server
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const address = getClientAddress();
	const content = validList(await request.json().catch(() => null));
	if (!content) {
		return json(
			{
				error: `Send { "title": "...", "urls": [...] }: a title of 1 to ${MAX_TITLE} characters, a description of at most ${MAX_DESCRIPTION}, 1 to 200 links.`
			},
			{ status: 400 }
		);
	}
	// Only lists that would be saved count against the limit
	if (!allowSave(address)) {
		return json(
			{ error: 'Too many saved lists from your address. Try again in a minute.' },
			{ status: 429 }
		);
	}
	try {
		const id = await saveList(content, (urls) => fetchDetails(urls, address));
		return json({ id, path: `/l/${id}` }, { headers: { 'cache-control': 'no-store' } });
	} catch (err) {
		console.error('saving a list failed', err);
		return json(
			{ error: 'The link service cannot be reached. Try again in a moment.' },
			{ status: 502 }
		);
	}
};
