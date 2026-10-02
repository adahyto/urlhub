import { json } from '@sveltejs/kit';
import { allowCreate, saveCollection, validCollection } from '$lib/server/collections';
import type { RequestHandler } from './$types';

/** POST { urls, view, advanced, lang } -> { id, path: "/c/<id>" }; the short link of a list (lib/server/collections.ts) */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!allowCreate(getClientAddress())) {
		return json(
			{ error: 'Too many short links from your address. Try again in a minute.' },
			{ status: 429 }
		);
	}
	const collection = validCollection(await request.json().catch(() => null));
	if (!collection)
		return json({ error: 'Send { "urls": [...] } with 1 to 200 links.' }, { status: 400 });
	const id = await saveCollection(collection);
	return json({ id, path: `/c/${id}` }, { headers: { 'cache-control': 'no-store' } });
};
