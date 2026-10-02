import { getContext, setContext } from 'svelte';
import en from './en.json';
import pl from './pl.json';
import { LOCALES, type Lang } from './lang';

export * from './lang';

/** A text with forms by number: en needs one/other, pl one/few/many/other (Intl.PluralRules picks one) */
type Plural = { one: string; other: string };
type Dictionary = typeof en;

// pl must have every key of en: a missing translation fails `npm run check`
const DICTIONARIES: Record<Lang, Dictionary> = { en, pl };

/** Every key of the dictionaries, as "form.fetch", "seo.title-too-long", ... */
type Keys<T, Prefix extends string = ''> = {
	[K in keyof T & string]: T[K] extends string | Plural
		? `${Prefix}${K}`
		: Keys<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
export type Key = Keys<Dictionary>;

export type Params = Record<string, string | number>;
export type Translate = (key: Key, params?: Params) => string;

const lookup = (lang: Lang, key: string): unknown =>
	key
		.split('.')
		.reduce<unknown>(
			(node, part) => (node as Record<string, unknown> | undefined)?.[part],
			DICTIONARIES[lang]
		);

const translators = new Map<Lang, Translate>();

/**
 * t(key, params) in a language: {name} is replaced by params.name; a text with forms by number takes the form
 * for params.count. An unknown key comes back as it is, so a gap shows instead of breaking the page.
 */
export function translator(lang: Lang): Translate {
	const cached = translators.get(lang);
	if (cached) return cached;
	const plural = new Intl.PluralRules(LOCALES[lang]);
	const t: Translate = (key, params = {}) => {
		let text = lookup(lang, key);
		if (text && typeof text === 'object') {
			const forms = text as Record<string, string>;
			text = forms[plural.select(Number(params.count ?? 0))] ?? forms.other;
		}
		if (typeof text !== 'string') return key;
		return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
			name in params ? String(params[name]) : whole
		);
	};
	translators.set(lang, t);
	return t;
}

/** Whether a key exists (SEO codes and link errors from ldb-api may be new to this app) */
export const has = (key: string): boolean => lookup('en', key) !== undefined;

export interface I18n {
	readonly lang: Lang;
	/** For Intl: dates and numbers */
	readonly locale: string;
	readonly t: Translate;
}

const CONTEXT = Symbol('i18n');

/** In the root layout: the language of the page, read through getters so that it follows ?lang= */
export const provideI18n = (lang: () => Lang): void => {
	setContext<I18n>(CONTEXT, {
		get lang() {
			return lang();
		},
		get locale() {
			return LOCALES[lang()];
		},
		get t() {
			return translator(lang());
		}
	});
};

export const useI18n = (): I18n => getContext<I18n>(CONTEXT);
