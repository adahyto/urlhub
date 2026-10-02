import type { Handle } from '@sveltejs/kit';
import { langOf } from '$lib/i18n/lang';

// The page is rendered in the visitor's language at once (no English flash), with <html lang> to match
export const handle: Handle = async ({ event, resolve }) => {
	const lang = langOf(event.url, event.request.headers.get('accept-language'));
	event.locals.lang = lang;
	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', lang)
	});
	// Without ?lang= the language depends on the browser's; caches must keep the versions apart
	if (!event.url.searchParams.has('lang')) response.headers.append('vary', 'Accept-Language');
	return response;
};
