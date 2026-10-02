import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const startedAt = Date.now();

/** GET /health — this app is up (the /status page shows ldb-api's /health next to it) */
export const GET: RequestHandler = () =>
	json(
		{
			status: 'ok',
			startedAt: new Date(startedAt).toISOString(),
			uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
			node: process.version
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
