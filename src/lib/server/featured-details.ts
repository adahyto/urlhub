import { setKey, type FeaturedSet } from '$lib/featured';
import type { ApiUrl } from '$lib/types';
import { fetchDetails } from './ldb';

/*
 * The details of a featured set's links, read here so that its page comes with them in the HTML (search engines
 * read it, visitors see it at once). Kept an hour; one reading at a time per set. When ldb-api does not answer
 * within a few seconds the page goes without, and the browser fetches them as for any list.
 */

const KEEP_MS = 60 * 60 * 1000;
const WAIT_MS = 8000;

const kept = new Map<string, { at: number; items: ApiUrl[] }>();
const reading = new Map<string, Promise<ApiUrl[] | null>>();

export async function detailsOf(set: FeaturedSet, address: string): Promise<ApiUrl[] | null> {
	const key = setKey(set);
	const hit = kept.get(key);
	if (hit && Date.now() - hit.at < KEEP_MS) return hit.items;
	let read = reading.get(key);
	if (!read) {
		read = fetchDetails(set.urls, address)
			.then((items) => {
				kept.set(key, { at: Date.now(), items });
				return items;
			})
			.catch(() => null)
			.finally(() => reading.delete(key));
		reading.set(key, read);
	}
	const late = new Promise<null>((resolve) => setTimeout(() => resolve(null), WAIT_MS).unref());
	// An older reading is better than none while a new one is late
	return (await Promise.race([read, late])) ?? hit?.items ?? null;
}
