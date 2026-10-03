import { error } from '@sveltejs/kit';
import { withImages } from '$lib/server/images';
import { loadList } from '$lib/server/lists';
import type { PageServerLoad } from './$types';

// A saved list: rendered here at once from its snapshot, pictures through /img as everywhere else
export const load: PageServerLoad = async ({ params }) => {
	const list = await loadList(params.id);
	if (!list) error(404, 'saved-list-missing');
	return { id: params.id, list: { ...list, items: list.items.map(withImages) } };
};
