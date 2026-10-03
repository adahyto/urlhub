import { createHash } from 'node:crypto';
import {
	mkdir,
	readFile,
	readdir,
	rename,
	stat,
	unlink,
	utimes,
	writeFile
} from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '$env/dynamic/private';
import type { View } from '$lib/types';

/*
 * Short links (/c/<id>): the list of links of a result, kept on the server so a short address can open it.
 * One JSON file per list in DATA_DIR (a Docker volume, in the server's daily backup). Only what the list needs is
 * kept: the links, the view, the advanced option and the language; no address, account or cookie. A list nobody
 * opened for 90 days is deleted. The same list always gets the same id, so sharing it twice stores it once.
 */

export interface Collection {
	urls: string[];
	view: View;
	advanced: boolean;
	lang: string;
}

const MAX_URLS = 200;
const MAX_URL_LENGTH = 2048;
const KEEP_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const ID = /^[0-9A-Za-z]{8,16}$/;

/** Where short links and saved lists are kept (the Docker volume) */
export const dataDir = () => env.DATA_DIR || 'data';
const fileOf = (id: string) => join(dataDir(), 'collections', `${id}.json`);

/** The list as stored, or null when it is not a valid one */
export function validCollection(input: unknown): Collection | null {
	const data = input as Partial<Collection> | null;
	const urls = data?.urls;
	if (
		!Array.isArray(urls) ||
		!urls.length ||
		urls.length > MAX_URLS ||
		!urls.every(
			(u) => typeof u === 'string' && u.length <= MAX_URL_LENGTH && /^https?:\/\//i.test(u)
		)
	) {
		return null;
	}
	return {
		urls,
		view: data?.view === 'table' || data?.view === 'json' ? data.view : 'tiles',
		advanced: data?.advanced === true,
		lang: data?.lang === 'pl' ? 'pl' : 'en'
	};
}

/** The id of a list: from its content (base62 of SHA-256), longer only if two lists ever share the start */
export const idsOf = (content: unknown) => {
	let n = BigInt(`0x${createHash('sha256').update(JSON.stringify(content)).digest('hex')}`);
	let all = '';
	while (all.length < 16) {
		all += ALPHABET[Number(n % 62n)];
		n /= 62n;
	}
	return [all.slice(0, 8), all.slice(0, 12), all];
};

/** Stores the list (if it is not there yet) and returns its id */
export async function saveCollection(collection: Collection): Promise<string> {
	await mkdir(join(dataDir(), 'collections'), { recursive: true });
	const content = JSON.stringify(collection);
	for (const id of idsOf(collection)) {
		const existing = await readFile(fileOf(id), 'utf8').catch(() => null);
		if (existing === content) {
			await touch(id);
			return id;
		}
		if (existing === null) {
			await writeWhole(fileOf(id), content);
			return id;
		}
	}
	throw new Error('no free id');
}

/** Written whole or not at all: a reader never sees half a file */
export async function writeWhole(file: string, content: string): Promise<void> {
	const part = `${file}.${process.pid}.part`;
	await writeFile(part, content, { mode: 0o600 });
	await rename(part, file);
}

/** Opening a file counts as using it: its days until deletion start again */
export const touchFile = (file: string) => {
	const now = new Date();
	return utimes(file, now, now).catch(() => {});
};

/** Opening a list counts as using it: its 90 days start again */
const touch = (id: string) => touchFile(fileOf(id));

/** The list behind an id, or null (unknown, expired or not an id) */
export async function loadCollection(id: string): Promise<Collection | null> {
	if (!ID.test(id)) return null;
	const raw = await readFile(fileOf(id), 'utf8').catch(() => null);
	const collection = raw ? validCollection(JSON.parse(raw)) : null;
	if (collection) await touch(id);
	return collection;
}

/** Deletes the lists nobody opened for KEEP_DAYS; returns how many */
export const deleteExpired = (now = Date.now()) =>
	deleteOlderThan(join(dataDir(), 'collections'), KEEP_DAYS, now);

/** Deletes the JSON files of a folder not opened (touched) for `days`; returns how many */
export async function deleteOlderThan(folder: string, days: number, now = Date.now()) {
	const names = await readdir(folder).catch(() => [] as string[]);
	let deleted = 0;
	for (const name of names.filter((n) => n.endsWith('.json'))) {
		const file = join(folder, name);
		const info = await stat(file).catch(() => null);
		if (info && now - info.mtimeMs > days * DAY_MS) {
			await unlink(file).catch(() => {});
			deleted++;
		}
	}
	return deleted;
}

/**
 * A limit of things created per visitor address and minute (short links, saved lists), each with its own count.
 * The address is kept in memory only, never stored, and forgotten a minute later, as /privacy says.
 */
export function perMinuteLimit(perMinute: number): (address: string, now?: number) => boolean {
	const recent = new Map<string, number[]>();
	setInterval(() => {
		const now = Date.now();
		for (const [address, times] of recent) {
			if (times.every((t) => now - t >= 60_000)) recent.delete(address);
		}
	}, 60_000).unref();
	return (address, now = Date.now()) => {
		const times = (recent.get(address) ?? []).filter((t) => now - t < 60_000);
		if (times.length >= perMinute) {
			recent.set(address, times);
			return false;
		}
		times.push(now);
		recent.set(address, times);
		if (recent.size > 10_000) recent.clear();
		return true;
	};
}

/** Short links created per visitor address and minute */
export const allowCreate = perMinuteLimit(10);
