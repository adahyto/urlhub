import { FEATURED, setKey, todayInPoland } from '$lib/featured';
import { proxyUrl } from '$lib/server/images';
import type { PageServerLoad } from './$types';

// The day decides which seasonal sets show; read on the server so the page and the browser agree on it.
// The cards' pictures go through /img, whose addresses only this server can sign.
export const load: PageServerLoad = () => ({
	today: todayInPoland(),
	covers: Object.fromEntries(
		FEATURED.map((set) => [setKey(set), (set.covers ?? []).map((src) => proxyUrl(src, 240))])
	) as Record<string, string[]>
});
