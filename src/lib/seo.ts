import { LANGS } from '$lib/i18n/lang';

/*
 * Addresses for search engines: each page in Polish and English (?lang=pl / ?lang=en) and without ?lang= for
 * everyone else (x-default: the language comes from the browser). Built from the site's origin (ORIGIN on the
 * server), so a domain only needs ORIGIN changed.
 */

export const pageIn = (origin: string, path: string, lang?: string) =>
	`${origin}${path}${lang ? `?lang=${lang}` : ''}`;

/** <link rel="alternate" hreflang> entries for a page: each language and x-default */
export const alternates = (origin: string, path: string) => [
	...LANGS.map((lang) => ({ hreflang: lang, href: pageIn(origin, path, lang) })),
	{ hreflang: 'x-default', href: pageIn(origin, path) }
];

/** The pages worth indexing; results (?urls=), short links, /status and /api are not */
export const INDEXED = ['/', '/privacy'];
