import { alternates, INDEXED, pageIn } from '$lib/seo';
import { LANGS } from '$lib/i18n/lang';
import { FEATURED, setPath } from '$lib/featured';
import type { RequestHandler } from './$types';

/**
 * The indexed pages in both languages, each with its language versions (src/lib/seo.ts), and every featured set's
 * page, out of season too, with its version in the other language when it has one
 */
export const GET: RequestHandler = ({ url }) => {
	const entries = INDEXED.flatMap((path) =>
		LANGS.map(
			(lang) => `  <url>
    <loc>${pageIn(url.origin, path, lang)}</loc>
${alternates(url.origin, path)
	.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}"/>`)
	.join('\n')}
  </url>`
		)
	);
	const sets = FEATURED.map((set) => {
		const other = set.alternate
			? FEATURED.find((s) => s.lang !== set.lang && s.id === set.alternate)
			: undefined;
		const versions = other
			? [set, other]
					.map(
						(v) =>
							`    <xhtml:link rel="alternate" hreflang="${v.lang}" href="${url.origin}${setPath(v)}"/>`
					)
					.join('\n') + '\n'
			: '';
		return `  <url>
    <loc>${url.origin}${setPath(set)}</loc>
${versions}  </url>`;
	});
	// The pages of all sets, in both languages
	const indexes = LANGS.map(
		(lang) => `  <url>
    <loc>${url.origin}/s/${lang}</loc>
${LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${url.origin}/s/${l}"/>`).join('\n')}
  </url>`
	);
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[...entries, ...indexes, ...sets].join('\n')}
</urlset>
`;
	return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
