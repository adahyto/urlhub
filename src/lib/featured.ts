import type { Lang } from './i18n/lang';
import data from './featured.json' with { type: 'json' };

/*
 * Featured sets (featured.json): lists of links the empty home page offers to open with one click, so a first
 * visitor sees what urlhub does before pasting anything. Each language has its own sets: a Polish charity means
 * little in English. Every link is checked with ldb-api before it goes in, and again from time to time:
 * `npm run featured:check` on the server lists the links that fail, are blocked or have no picture.
 * The home page shows the sets in the file's order; a set with a season ("MM-DD" to "MM-DD", both included, may
 * run over the new year) shows only then.
 * `covers`: up to three pictures of its links for its card, written by `npm run featured:check -- --covers`.
 */

export interface FeaturedSet {
	/** Unique within its language; the set's address /s/<lang>/<id>, with the year for a set that is redone each year */
	id: string;
	/** Earlier ids: their addresses lead here, so links already shared keep working */
	aliases?: string[];
	lang: Lang;
	season?: { from: string; to: string };
	view: 'tiles' | 'table';
	title: string;
	description: string;
	/** A few sentences above the links on the set's page: what the set is and why these links */
	intro?: string;
	/** The id of the same set in the other language, for search engines (hreflang) */
	alternate?: string;
	urls: string[];
	/** Pictures (absolute addresses) shown on the card, through /img */
	covers?: string[];
}

export const FEATURED = data as FeaturedSet[];

/** The home page shows this many; the rest wait behind "More" */
export const SHOWN_FIRST = 6;

export const inSeason = ({ from, to }: { from: string; to: string }, today: string) =>
	from <= to ? today >= from && today <= to : today >= from || today <= to;

/** The sets of a language shown on a day ("MM-DD"): in the file's order, those out of season left out */
export function featuredFor(lang: Lang, today: string): FeaturedSet[] {
	return FEATURED.filter((s) => s.lang === lang && (!s.season || inSeason(s.season, today)));
}

/** The sets of a language not shown on a day: out of season, kept for links already shared and as an archive */
export const outOfSeason = (lang: Lang, today: string): FeaturedSet[] =>
	FEATURED.filter((s) => s.lang === lang && s.season && !inSeason(s.season, today));

/** A set's page */
export const setPath = (set: Pick<FeaturedSet, 'lang' | 'id'>) => `/s/${set.lang}/${set.id}`;

/** How a set is named in the covers the page gets: "pl/halloween" */
export const setKey = (set: Pick<FeaturedSet, 'lang' | 'id'>) => `${set.lang}/${set.id}`;

/** Today as "MM-DD" in Poland, where the seasons are decided */
export const todayInPoland = (now = new Date()) =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Warsaw',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
