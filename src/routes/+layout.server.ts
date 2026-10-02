import { langOf } from '$lib/i18n/lang';
import type { LayoutServerLoad } from './$types';

// Read from the address here too, so that switching ?lang= on the page reloads the language
export const load: LayoutServerLoad = ({ url, request }) => ({
	lang: langOf(url, request.headers.get('accept-language'))
});
