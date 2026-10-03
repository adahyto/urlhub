/** The address to show a result's picture through this server (/img), or '' when there is none: the browser never
 * fetches pictures from other sites. `src` may be relative to the page, as pages write it. */
export function proxied(
	item: { url: string; finalUrl?: string; images?: Record<string, string> },
	src: string | undefined,
	base = item.url
): string {
	if (!src || !item.images) return '';
	try {
		return item.images[new URL(src, base).href] ?? '';
	} catch {
		return '';
	}
}
