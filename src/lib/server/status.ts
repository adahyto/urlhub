import { env } from '$env/dynamic/private';

/** Counts ldb-api keeps per period (see its lib/stats.js) */
export interface Counts {
	requests: number;
	refused: number;
	links: number;
	failed: number;
	cancelled: number;
	cached: number;
	youtubeApiCalls: number;
	youtubeOembed: number;
}

/** ldb-api's GET /health */
export interface ApiHealth {
	status: string;
	startedAt: string;
	uptimeSeconds: number;
	node: string;
	lastHour: Counts;
	last24h: Counts;
	hours: (Counts & { start: string })[];
	youtube: {
		apiKey: boolean;
		quotaDay: string;
		unitsUsed: number;
		dailyUnits: number;
		problem: string;
	};
	cache: { pages: { entries: number; bytes: number }; videos: { entries: number } };
}

export interface Check {
	name: string;
	url: string;
	ok: boolean;
	/** HTTP status, or why there was none */
	detail: string;
	ms: number;
}

export interface Status {
	checkedAt: string;
	checks: Check[];
	api: ApiHealth | null;
}

// ldb-api's /health sits next to its /json
const apiHealthUrl = () =>
	new URL('/health', env.LDB_API_URL || 'http://51.75.116.68:84/json').href;

const TIMEOUT_MS = 5_000;
// Every viewer of /status reloads it every 30 s: ask the others at most this often, whoever is looking
const FRESH_MS = 10_000;

const check = async (name: string, url: string): Promise<{ check: Check; response?: Response }> => {
	const started = Date.now();
	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
		return {
			check: {
				name,
				url,
				ok: response.ok,
				detail: `HTTP ${response.status}`,
				ms: Date.now() - started
			},
			response
		};
	} catch (error) {
		const detail =
			error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'no connection';
		return { check: { name, url, ok: false, detail, ms: Date.now() - started } };
	}
};

const gather = async (): Promise<Status> => {
	const api = await check('ldb-api', apiHealthUrl());
	let health: ApiHealth | null = null;
	if (api.response?.ok) health = await api.response.json().catch(() => null);
	else api.response?.body?.cancel().catch(() => {});
	const self: Check = { name: 'urlhub', url: '/health', ok: true, detail: 'this page', ms: 0 };
	return { checkedAt: new Date().toISOString(), checks: [self, api.check], api: health };
};

let last: { at: number; status: Promise<Status> } | null = null;

/** The state of urlhub and ldb-api, asked again at most every FRESH_MS */
export const getStatus = (): Promise<Status> => {
	if (!last || Date.now() - last.at > FRESH_MS) last = { at: Date.now(), status: gather() };
	return last.status;
};
