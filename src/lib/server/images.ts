import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { env } from '$env/dynamic/private';
import sharp from 'sharp';
import type { ApiUrl } from '$lib/types';

/*
 * Preview pictures go through this server (/img) instead of the visitor's browser fetching them from other sites:
 * the visitor's address and cookies stay away from those sites, and pictures come small. Only pictures of results
 * this server handed out can be fetched: their addresses carry a signature, so /img is not an open proxy.
 */

// Signs the picture addresses; set IMAGE_PROXY_SECRET so they keep working after a restart (e.g. in recent queries)
const secret = env.IMAGE_PROXY_SECRET || randomBytes(32).toString('hex');

/** Widths the pictures come in: tiles and the table, the featured sets' cards, and favicons (16 px, sharp on any screen) */
export const WIDTHS = [480, 240, 64] as const;
const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|svg)(\?.*)?$/i;

const sign = (src: string, width: number) =>
	createHmac('sha256', secret).update(`${width}|${src}`).digest('base64url').slice(0, 22);

export function verify(src: string, width: number, signature: string): boolean {
	const expected = sign(src, width);
	return (
		signature.length === expected.length &&
		timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
	);
}

/** The address of a picture through /img, signed so that only pictures this server hands out can be fetched */
export const proxyUrl = (src: string, width: number) =>
	`/img?u=${encodeURIComponent(src)}&w=${width}&s=${sign(src, width)}`;

const absolute = (value: string | undefined, base: string) => {
	if (!value) return '';
	try {
		const url = new URL(value, base);
		return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
	} catch {
		return '';
	}
};

/** The result with `images`: each of its pictures (absolute address) → the address to show it through /img */
export function withImages(result: ApiUrl): ApiUrl {
	const images: Record<string, string> = {};
	const add = (src: string, width: number) => {
		if (src && !images[src]) images[src] = proxyUrl(src, width);
	};
	add(absolute(result.ogImg?.ogImg, result.url), 480);
	if (result.type === 'image' || IMAGE_RE.test(result.url))
		add(absolute(result.url, result.url), 480);
	add(absolute(result.favicon, result.finalUrl || result.url), 64);
	return { ...result, images };
}

// ---- fetching: public addresses only, small and quick ----

const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 6000;
// In the end-to-end tests the pictures come from the fake ldb-api on 127.0.0.1
const allowPrivate = () => env.IMAGE_PROXY_ALLOW_PRIVATE === '1';

function isPrivate(address: string): boolean {
	if (isIP(address) === 4) {
		const [a, b] = address.split('.').map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			a >= 224
		);
	}
	const v6 = address.toLowerCase();
	if (v6.startsWith('::ffff:')) return isPrivate(v6.slice(7));
	return (
		v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || v6.startsWith('ff')
	);
}

async function checkUrl(value: string): Promise<URL> {
	const url = new URL(value);
	if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
		throw new Error('bad-url');
	}
	if (allowPrivate()) return url;
	const host = url.hostname.replace(/^\[|\]$/g, '');
	const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
	if (!addresses.length || addresses.some((a) => isPrivate(a.address))) throw new Error('private');
	return url;
}

async function download(src: string): Promise<{ body: Buffer; type: string }> {
	let url = await checkUrl(src);
	for (let hop = 0; hop < 4; hop += 1) {
		const response = await fetch(url, {
			redirect: 'manual',
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { 'user-agent': 'urlhub image preview', accept: 'image/*' }
		});
		const location = response.headers.get('location');
		if (response.status >= 300 && response.status < 400 && location) {
			url = await checkUrl(new URL(location, url).href);
			continue;
		}
		if (!response.ok || !response.body) throw new Error(`http-${response.status}`);
		const chunks: Uint8Array[] = [];
		let size = 0;
		for await (const chunk of response.body) {
			size += chunk.length;
			if (size > MAX_BYTES) throw new Error('too-large');
			chunks.push(chunk);
		}
		return { body: Buffer.concat(chunks), type: response.headers.get('content-type') ?? '' };
	}
	throw new Error('redirects');
}

// ---- making it small, keeping it a while ----

type Picture = { body: Buffer; type: string };
const CACHE_BYTES = 64 * 1024 * 1024;
const cache = new Map<string, Picture>();
let cached = 0;

function remember(key: string, picture: Picture) {
	cache.set(key, picture);
	cached += picture.body.length;
	// the oldest go first (a Map keeps insertion order; a hit moves its entry to the end)
	for (const [oldKey, old] of cache) {
		if (cached <= CACHE_BYTES) break;
		cache.delete(oldKey);
		cached -= old.body.length;
	}
}

// A few pictures at a time, so a long list can't swamp the server
let running = 0;
const waiting: (() => void)[] = [];
async function slot<T>(work: () => Promise<T>): Promise<T> {
	if (running >= 6) await new Promise<void>((resolve) => waiting.push(resolve));
	running += 1;
	try {
		return await work();
	} finally {
		running -= 1;
		waiting.shift()?.();
	}
}

// Favicons are often .ico, which sharp can't read: small ones pass as they are
const PASS_THROUGH = /^image\/(x-icon|vnd\.microsoft\.icon|png|gif|jpeg|webp)$/;

/** The picture at src, at most `width` wide, as WebP when it can be converted */
export async function picture(src: string, width: number): Promise<Picture> {
	const key = `${width}|${src}`;
	const hit = cache.get(key);
	if (hit) {
		cache.delete(key);
		cache.set(key, hit);
		return hit;
	}
	const result = await slot(async () => {
		const { body, type } = await download(src);
		try {
			const webp = await sharp(body, { animated: false, limitInputPixels: 40_000_000 })
				.rotate()
				.resize({ width, withoutEnlargement: true })
				.webp({ quality: 72 })
				.toBuffer();
			return { body: webp, type: 'image/webp' };
		} catch {
			const plain = type.split(';')[0].trim().toLowerCase();
			if (PASS_THROUGH.test(plain) && body.length <= 512 * 1024) return { body, type: plain };
			throw new Error('not-an-image');
		}
	});
	remember(key, result);
	return result;
}
