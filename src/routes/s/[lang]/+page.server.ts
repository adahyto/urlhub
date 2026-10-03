import { error } from '@sveltejs/kit';
import { isLang } from '$lib/i18n/lang';
import { todayInPoland } from '$lib/featured';
import { featuredCovers } from '$lib/server/covers';
import type { PageServerLoad } from './$types';

// All featured sets of a language: those of now, then those out of season (an archive, for search engines too)
export const load: PageServerLoad = ({ params }) => {
	if (!isLang(params.lang)) error(404, 'featured-missing');
	return { lang: params.lang, today: todayInPoland(), covers: featuredCovers() };
};
