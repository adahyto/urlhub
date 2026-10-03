import { error } from '@sveltejs/kit';
import { FEATURED } from '$lib/featured';
import { proxyUrl } from '$lib/server/images';
import type { PageServerLoad } from './$types';

// A featured set (lib/featured.json) as a page of its own; out of season it still opens, for links already shared
export const load: PageServerLoad = ({ params }) => {
	const set = FEATURED.find((s) => s.lang === params.lang && s.id === params.id);
	if (!set) error(404, 'featured-missing');
	// What a messenger shows: the set's first picture, signed here like every picture through /img
	return { set, image: set.covers?.[0] ? proxyUrl(set.covers[0], 480) : '' };
};
