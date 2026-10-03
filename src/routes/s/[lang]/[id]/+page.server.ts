import { error, redirect } from '@sveltejs/kit';
import { FEATURED } from '$lib/featured';
import { detailsOf } from '$lib/server/featured-details';
import { proxyUrl, withImages } from '$lib/server/images';
import type { PageServerLoad } from './$types';

// A featured set (lib/featured.json) as a page of its own; out of season it still opens, for links already shared
// and for search engines. Its links' details come with the page when ldb-api answers in time.
export const load: PageServerLoad = async ({ params, url, getClientAddress }) => {
	const inLang = FEATURED.filter((s) => s.lang === params.lang);
	const set = inLang.find((s) => s.id === params.id);
	if (!set) {
		// An earlier address of a set: its own address now, for good
		const renamed = inLang.find((s) => s.aliases?.includes(params.id));
		if (renamed) redirect(301, `/s/${renamed.lang}/${renamed.id}${url.search}`);
		error(404, 'featured-missing');
	}
	const items = await detailsOf(set, getClientAddress());
	return {
		set,
		items: items?.map(withImages) ?? null,
		// What a messenger shows: the set's first picture, signed here like every picture through /img
		image: set.covers?.[0] ? proxyUrl(set.covers[0], 480) : ''
	};
};
