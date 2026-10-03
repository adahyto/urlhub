import type { Lang } from './i18n/lang';
import data from './featured.json' with { type: 'json' };

/*
 * Featured sets (featured.json): lists of links the empty home page offers to open with one click, so a first
 * visitor sees what urlhub does before pasting anything. Each language has its own sets: a Polish charity means
 * little in English. Every link is checked with ldb-api before it goes in, and again from time to time:
 * `npm run featured:check` on the server lists the links that fail, are blocked or have no picture.
 * A set with a season ("MM-DD" to "MM-DD", both included, may run over the new year) shows only then, first.
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
	urls: string[];
	/** Pictures (absolute addresses) shown on the card, through /img */
	covers?: string[];
}

export const FEATURED = data as FeaturedSet[];

/** The home page shows this many; the rest wait behind "More" */
export const SHOWN_FIRST = 6;

export const inSeason = ({ from, to }: { from: string; to: string }, today: string) =>
	from <= to ? today >= from && today <= to : today >= from || today <= to;

/** The sets of a language for a day ("MM-DD"): those in season first, then the others in the file's order */
export function featuredFor(lang: Lang, today: string): FeaturedSet[] {
	const sets = FEATURED.filter((s) => s.lang === lang);
	return [
		...sets.filter((s) => s.season && inSeason(s.season, today)),
		...sets.filter((s) => !s.season)
	];
}

/** How a set is named in the covers the page gets: "pl/halloween" */
export const setKey = (set: Pick<FeaturedSet, 'lang' | 'id'>) => `${set.lang}/${set.id}`;

/** Today as "MM-DD" in Poland, where the seasons are decided */
export const todayInPoland = (now = new Date()) =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: 'Europe/Warsaw',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
