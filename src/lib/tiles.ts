import type { Row, TileUrl } from './types';

/** A result row in the shape the tiles use */
export function toTileUrl(item: Row): TileUrl {
	const raw = item.ogImg?.ogImg ?? '';
	let src = '';
	if (raw) {
		try {
			src = new URL(raw, item.url).href;
		} catch {
			src = raw;
		}
	}
	return {
		url: item.url,
		type: item.type ?? 'page',
		title: item.title,
		desc: item.desc,
		ogImg: { src, alt: item.ogImg?.ogImgAlt ?? '' },
		channel: item.channel ?? '',
		duration: item.duration ?? '',
		error: item.error ?? '',
		site: item.siteName ?? '',
		images: item.images ?? {},
		pending: item.pending
	};
}
