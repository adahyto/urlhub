/** The interface languages; the dictionaries are en.json and pl.json next to this file */
export const LANGS = ['en', 'pl'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';

/** Locale for dates and numbers */
export const LOCALES: Record<Lang, string> = { en: 'en-GB', pl: 'pl-PL' };

export const isLang = (value: unknown): value is Lang => LANGS.includes(value as Lang);

/**
 * First supported language of an Accept-Language header, by quality: "de-DE,pl;q=0.8,en;q=0.5" → "pl".
 * The default language when none fits.
 */
export const pickLanguage = (acceptLanguage: string): Lang =>
	acceptLanguage
		.split(',')
		.map((part, index) => {
			const [tag, ...params] = part.trim().split(';');
			const q = params.map((p) => /^\s*q=([\d.]+)\s*$/.exec(p)?.[1]).find((v) => v !== undefined);
			return {
				lang: tag.trim().split('-')[0].toLowerCase(),
				quality: q === undefined ? 1 : Number(q),
				index
			};
		})
		.filter(({ quality }) => quality > 0)
		.sort((a, b) => b.quality - a.quality || a.index - b.index)
		.map(({ lang }) => lang)
		.find(isLang) ?? DEFAULT_LANG;

/**
 * The language of a request: ?lang= in the address when it names one, then the language of a featured set's page
 * (/s/<lang>/...: its content is in that language), otherwise the browser's. Nothing is stored on the visitor's
 * device: a shared link carries its language.
 */
export const langOf = (url: URL, acceptLanguage: string | null): Lang => {
	const asked = url.searchParams.get('lang');
	if (isLang(asked)) return asked;
	const ofSet = /^\/s\/([a-z]{2})(\/|$)/.exec(url.pathname)?.[1];
	return isLang(ofSet) ? ofSet : pickLanguage(acceptLanguage ?? '');
};
