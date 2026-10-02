import type { RequestHandler } from './$types';

// Search engines may read the pages, not the API or the short links (which only redirect to results, and
// results are noindex); the sitemap lists the pages worth indexing
export const GET: RequestHandler = ({ url }) =>
	new Response(
		`User-agent: *
Disallow: /api/
Disallow: /c/

Sitemap: ${url.origin}/sitemap.xml
`,
		{ headers: { 'content-type': 'text/plain; charset=utf-8' } }
	);
