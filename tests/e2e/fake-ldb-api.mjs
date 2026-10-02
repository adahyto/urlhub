// A stand-in for ldb-api in the end-to-end tests: answers like it (NDJSON with the list of links on the first
// line, results as they are ready, 413 over 200 links, /health), from the link's path instead of the network,
// so the tests are quick and always the same. GET /__requests lists the bodies it got, POST /__reset forgets.
//
//   /slow...   answers after 4 s          /dead...   fails with "host not found"
//   /flaky...  fails once, then works     /video...  a YouTube video (duration, channel)
//   /stars...  a GitHub repository        /seo...    a page with an SEO warning (advanced)
//   /blocked...  a shop that refuses servers (403, title from the address)
import http from 'node:http';

const PORT = Number(process.env.FAKE_API_PORT || 13901);
const MAX_URLS = 200;

let requests = [];
let attempts = new Map();

const findLinks = (text) => [
	...new Set(
		(
			String(text ?? '')
				.replace(/[-,;]*(?=https?:\/\/)/gi, ' ')
				.match(/https?:\/\/[^\s<>"'`]+/gi) ?? []
		).map((url) => url.replace(/[.,;:!?'"\]]+$/, ''))
	)
];

const sleep = (ms, signal) =>
	new Promise((resolve) => {
		const timer = setTimeout(resolve, ms);
		signal.addEventListener('abort', () => {
			clearTimeout(timer);
			resolve();
		});
	});

function details(url, advanced) {
	const path = new URL(url).pathname;
	const base = {
		url,
		type: 'page',
		title: `Title of ${path}`,
		desc: `A page at ${path}`,
		ogImg: { ogImg: '', ogImgAlt: '' },
		siteName: '',
		favicon: '',
		lang: 'en',
		published: '',
		author: '',
		finalUrl: url,
		status: 200,
		responseMs: 5,
		service: '',
		extra: {}
	};
	const more = advanced
		? {
				keywords: '',
				ogDesc: '',
				ogTitle: '',
				canonical: url,
				robots: '',
				yTDur: '',
				urls: [],
				htmlTags: {},
				warnings: []
			}
		: {};
	const tries = (attempts.get(url) ?? 0) + 1;
	attempts.set(url, tries);
	if (path.startsWith('/dead') || (path.startsWith('/flaky') && tries === 1)) {
		const error = path.startsWith('/dead') ? 'host not found' : 'timeout';
		return { ...base, ...more, title: '', desc: '', status: null, responseMs: null, error };
	}
	if (path.startsWith('/blocked')) {
		return {
			...base,
			...more,
			title: 'Apple iphone 15 128GB czarny',
			desc: '',
			siteName: 'Allegro',
			status: 403,
			error: 'blocked'
		};
	}
	if (path.startsWith('/video')) {
		return {
			...base,
			...more,
			type: 'video',
			title: 'A video',
			service: 'youtube',
			siteName: 'YouTube',
			channel: 'A channel',
			author: 'A channel',
			duration: '00:03:34',
			status: null
		};
	}
	if (path.startsWith('/stars')) {
		return {
			...base,
			...more,
			title: 'owner/repo',
			service: 'github',
			siteName: 'GitHub',
			extra: { stars: 1234 }
		};
	}
	if (path.startsWith('/seo') && advanced) {
		const warning = {
			code: 'title-too-long',
			level: 'warning',
			message: 'Title is 72 characters (aim for at most 60).',
			params: { length: 72, max: 60 }
		};
		return { ...base, ...more, warnings: [warning] };
	}
	return { ...base, ...more };
}

const health = () => {
	const zero = {
		requests: 0,
		refused: 0,
		links: 0,
		failed: 0,
		cancelled: 0,
		cached: 0,
		youtubeApiCalls: 0,
		youtubeOembed: 0
	};
	const hour = Date.now() - (Date.now() % 3_600_000);
	return {
		status: 'ok',
		startedAt: new Date().toISOString(),
		uptimeSeconds: 1,
		node: process.version,
		lastHour: zero,
		last24h: zero,
		hours: Array.from({ length: 24 }, (_, i) => ({
			start: new Date(hour - (23 - i) * 3_600_000).toISOString(),
			...zero
		})),
		youtube: { apiKey: false, quotaDay: '', unitsUsed: 0, dailyUnits: 10000, problem: '' },
		cache: { pages: { entries: 0, bytes: 0 }, videos: { entries: 0 } }
	};
};

const send = (res, status, body) => {
	res.writeHead(status, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
};

http
	.createServer(async (req, res) => {
		const { pathname } = new URL(req.url, 'http://localhost');
		if (req.method === 'GET' && pathname === '/health') return send(res, 200, health());
		if (req.method === 'GET' && pathname === '/__requests') return send(res, 200, requests);
		if (req.method === 'POST' && pathname === '/__reset') {
			requests = [];
			attempts = new Map();
			return send(res, 200, { ok: true });
		}
		if (req.method !== 'POST' || pathname !== '/json') return send(res, 200, { ok: true });

		let raw = '';
		for await (const chunk of req) raw += chunk;
		const body = JSON.parse(raw || '{}');
		requests.push(body);
		const urls = findLinks(body.text ?? body.urls);
		if (urls.length > MAX_URLS)
			return send(res, 413, {
				error: `At most ${MAX_URLS} links per request, got ${urls.length}.`
			});
		const advanced = body.advanced === true;

		if (!/ndjson/.test(req.headers.accept ?? ''))
			return send(res, 200, { urls: urls.map((u) => details(u, advanced)) });

		const closed = new AbortController();
		res.on('close', () => closed.abort());
		res.writeHead(200, { 'content-type': 'application/x-ndjson; charset=utf-8' });
		res.write(`${JSON.stringify({ total: urls.length, urls })}\n`);
		await Promise.all(
			urls.map(async (url, index) => {
				await sleep(
					new URL(url).pathname.startsWith('/slow') ? 4000 : 50 + index * 20,
					closed.signal
				);
				if (!closed.signal.aborted)
					res.write(`${JSON.stringify({ index, result: details(url, advanced) })}\n`);
			})
		);
		if (!closed.signal.aborted) res.end(`${JSON.stringify({ done: true })}\n`);
	})
	.listen(PORT, '127.0.0.1', () => console.log(`fake ldb-api on ${PORT}`));
