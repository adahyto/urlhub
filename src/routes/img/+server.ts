import { error } from '@sveltejs/kit';
import { picture, verify, WIDTHS } from '$lib/server/images';
import type { RequestHandler } from './$types';

// GET /img?u=<picture>&w=<width>&s=<signature>: a preview picture through this server (src/lib/server/images.ts)
export const GET: RequestHandler = async ({ url }) => {
	const src = url.searchParams.get('u') ?? '';
	const width = Number(url.searchParams.get('w'));
	const signature = url.searchParams.get('s') ?? '';
	if (
		!src ||
		!WIDTHS.includes(width as (typeof WIDTHS)[number]) ||
		!verify(src, width, signature)
	) {
		error(404, 'Not found');
	}
	let found;
	try {
		found = await picture(src, width);
	} catch {
		error(502, 'The picture could not be fetched');
	}
	return new Response(new Uint8Array(found.body), {
		headers: {
			'content-type': found.type,
			// the address is signed and names one picture at one width: browsers may keep it for a day
			'cache-control': 'public, max-age=86400, immutable',
			// a picture, never a page: nothing in it can run, even if someone opens it directly
			'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
			'x-content-type-options': 'nosniff'
		}
	});
};
