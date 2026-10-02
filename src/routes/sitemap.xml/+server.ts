import { alternates, INDEXED, pageIn } from '$lib/seo';
import { LANGS } from '$lib/i18n/lang';
import type { RequestHandler } from './$types';

/** The indexed pages in both languages, each with its language versions (src/lib/seo.ts) */
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
	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;
	return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
