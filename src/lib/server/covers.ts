import { FEATURED, setKey } from '$lib/featured';
import { proxyUrl } from './images';

/** The featured cards' pictures through /img, by setKey: their addresses only this server can sign */
export const featuredCovers = (): Record<string, string[]> =>
	Object.fromEntries(
		FEATURED.map((set) => [setKey(set), (set.covers ?? []).map((src) => proxyUrl(src, 240))])
	);
