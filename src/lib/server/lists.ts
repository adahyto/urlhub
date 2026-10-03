import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Lang } from '$lib/i18n/lang';
import type { ApiUrl } from '$lib/types';
import {
	dataDir,
	deleteOlderThan,
	idsOf,
	perMinuteLimit,
	touchFile,
	writeWhole
} from './collections';

/*
 * Saved lists (/l/<id>): a list of links with a title, kept as a page of its own that nobody can change. The id
 * comes from the content (title, description, links, view, language), as for short links: a change makes a new
 * address, and the same content keeps the one it has. The details of the links are a snapshot this server takes
 * from ldb-api when the list is saved, never sent by the browser, so nobody can put a made-up title on someone
 * else's link. One JSON file per list in DATA_DIR/lists (the Docker volume, in the server's daily backup); a list
 * nobody opened for a year is deleted. To take one down (a report): delete DATA_DIR/lists/<id>.json.
 */

export interface ListContent {
	title: string;
	description: string;
	urls: string[];
	view: 'tiles' | 'table';
	lang: Lang;
}

export interface SavedList extends ListContent {
	/** ISO 8601 */
	savedAt: string;
	/** The links' details when the list was saved, in the order of urls */
	items: ApiUrl[];
}

export const MAX_TITLE = 80;
export const MAX_DESCRIPTION = 300;
const MAX_URLS = 200;
const MAX_URL_LENGTH = 2048;
const KEEP_DAYS = 365;
const ID = /^[0-9A-Za-z]{8,16}$/;

/** Saved lists per visitor address and minute, counted apart from short links */
export const allowSave = perMinuteLimit(10);

const folder = () => join(dataDir(), 'lists');
const fileOf = (id: string) => join(folder(), `${id}.json`);

/** One line of plain text: no control characters, single spaces */
const line = (value: unknown) =>
	typeof value === 'string'
		? value
				.replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
				.replace(/\s+/g, ' ')
				.trim()
		: '';

/** The list as it will be saved, or null when it is not a valid one */
export function validList(input: unknown): ListContent | null {
	const data = input as Partial<ListContent> | null;
	const title = line(data?.title);
	const description = line(data?.description);
	const urls = data?.urls;
	if (
		!title ||
		title.length > MAX_TITLE ||
		description.length > MAX_DESCRIPTION ||
		!Array.isArray(urls) ||
		!urls.length ||
		urls.length > MAX_URLS ||
		!urls.every(
			(u) => typeof u === 'string' && u.length <= MAX_URL_LENGTH && /^https?:\/\/\S+$/i.test(u)
		)
	) {
		return null;
	}
	return {
		title,
		description,
		urls,
		view: data?.view === 'table' ? 'table' : 'tiles',
		lang: data?.lang === 'pl' ? 'pl' : 'en'
	};
}

const sameContent = (a: ListContent, b: ListContent) =>
	JSON.stringify([a.title, a.description, a.urls, a.view, a.lang]) ===
	JSON.stringify([b.title, b.description, b.urls, b.view, b.lang]);

/** Only the basic details are kept: what the tiles and the table show (no advanced ones, no signed pictures) */
const BASIC = [
	'url',
	'type',
	'title',
	'desc',
	'ogImg',
	'siteName',
	'favicon',
	'lang',
	'published',
	'author',
	'finalUrl',
	'status',
	'service',
	'extra',
	'channel',
	'duration',
	'error'
] as const;

const basic = (result: ApiUrl) =>
	Object.fromEntries(
		BASIC.filter((key) => result[key] !== undefined).map((key) => [key, result[key]])
	) as unknown as ApiUrl;

/**
 * Saves the list (if it is not there yet) and returns its id. `snapshot` gets the details of the links; it is
 * asked only for a new list, so saving the same list again changes nothing.
 */
export async function saveList(
	content: ListContent,
	snapshot: (urls: string[]) => Promise<ApiUrl[]>
): Promise<string> {
	await mkdir(folder(), { recursive: true });
	const key = [content.title, content.description, content.urls, content.view, content.lang];
	for (const id of idsOf(key)) {
		const existing = await read(id);
		if (existing && sameContent(existing, content)) {
			await touchFile(fileOf(id));
			return id;
		}
		if (existing === null && !(await exists(id))) {
			const items = (await snapshot(content.urls)).map(basic);
			const list: SavedList = { ...content, savedAt: new Date().toISOString(), items };
			await writeWhole(fileOf(id), JSON.stringify(list));
			return id;
		}
	}
	throw new Error('no free id');
}

const exists = (id: string) =>
	readFile(fileOf(id)).then(
		() => true,
		() => false
	);

async function read(id: string): Promise<SavedList | null> {
	const raw = await readFile(fileOf(id), 'utf8').catch(() => null);
	if (!raw) return null;
	try {
		const list = JSON.parse(raw) as SavedList;
		return validList(list) && Array.isArray(list.items) ? list : null;
	} catch {
		return null;
	}
}

/** The list behind an id, or null (unknown, expired or not an id); opening it starts its year again */
export async function loadList(id: string): Promise<SavedList | null> {
	if (!ID.test(id)) return null;
	const list = await read(id);
	if (list) await touchFile(fileOf(id));
	return list;
}

/** Deletes the lists nobody opened for a year; returns how many */
export const deleteExpiredLists = (now = Date.now()) => deleteOlderThan(folder(), KEEP_DAYS, now);
