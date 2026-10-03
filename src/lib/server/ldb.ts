import { env } from '$env/dynamic/private';
import type { ApiUrl } from '$lib/types';

// ldb-api is called from this server, so the browser needs no CORS and never sees its address.
// In Docker LDB_API_URL points at it through the host (docker-compose.yaml); `npm run dev` uses the public one.
export const ldbApiUrl = () => env.LDB_API_URL || 'http://51.75.116.68:84/json';

/**
 * The basic details of the links, in their order, in one answer (not streamed); throws when ldb-api cannot be
 * reached or refuses. `address` is the visitor's: ldb-api limits links per visitor.
 */
export async function fetchDetails(urls: string[], address: string): Promise<ApiUrl[]> {
	const response = await fetch(ldbApiUrl(), {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-forwarded-for': address },
		body: JSON.stringify({ urls, advanced: false }),
		// ldb-api reads up to 200 links, 5 at a time (2 per site), 10 s each at worst
		signal: AbortSignal.timeout(300_000)
	});
	const answer = await response.json().catch(() => null);
	if (!response.ok || !Array.isArray(answer?.urls)) {
		throw new Error(`ldb-api answered ${response.status}: ${answer?.error ?? ''}`);
	}
	return answer.urls as ApiUrl[];
}
