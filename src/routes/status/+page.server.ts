import { getStatus } from '$lib/server/status';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store' });
	return { status: await getStatus() };
};
