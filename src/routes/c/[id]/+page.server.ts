import { error, redirect } from '@sveltejs/kit';
import { loadCollection } from '$lib/server/collections';
import type { PageServerLoad } from './$types';

// A short link opens the list at its full address, with the view, the option and the language it was shared with
export const load: PageServerLoad = async ({ params, url }) => {
	const collection = await loadCollection(params.id);
	if (!collection) error(404, 'short-link-missing');
	const target = new URLSearchParams({ urls: collection.urls.join(' ') });
	if (collection.view !== 'tiles') target.set('view', collection.view);
	if (collection.advanced && collection.view !== 'tiles') target.set('advanced', '1');
	// The visitor's own ?lang= wins over the language of whoever shared it
	target.set('lang', url.searchParams.get('lang') ?? collection.lang);
	redirect(302, `/?${target}`);
};
