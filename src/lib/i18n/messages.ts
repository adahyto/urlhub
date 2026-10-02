import { has, type Key, type Translate } from './index';
import type { QueryError } from '$lib/query.svelte';
import type { SeoWarning } from '$lib/types';

/** A link's error from ldb-api in the interface language ("host not found", "HTTP 404" stays as it is) */
export function linkError(t: Translate, error: string): string {
	const key = `linkErrors.${error.replace(/ /g, '-')}`;
	return has(key) ? t(key as Key) : error;
}

/** What went wrong with the whole query, in the interface language */
export function queryError(t: Translate, error: QueryError): string {
	switch (error.kind) {
		case 'empty':
			return t('errors.empty');
		case 'cutoff':
			return t('errors.cutoff');
		case 'network':
			return t('errors.network');
		case 'http': {
			// ldb-api: "At most 200 links per request, got 201."
			const counts = /(\d+)\D+(\d+)/.exec(error.message);
			if (error.status === 413 && counts)
				return t('errors.tooMany', { max: counts[1], count: counts[2] });
			if (error.status === 429) return t('errors.rateLimited');
			if (error.status === 502) return t('errors.unreachable');
			return error.message || t('errors.service', { status: error.status });
		}
	}
}

/**
 * An SEO warning in the interface language, from its code and params (ldb-api lib/seo.js); ldb-api's English
 * message when this app does not know the code yet or the API sent no params
 */
export function seoWarning(t: Translate, warning: SeoWarning): string {
	const key = `seo.${warning.code}`;
	if (!has(key) || !warning.params) return warning.message;
	const params = warning.params;
	return t(key as Key, {
		...Object.fromEntries(
			Object.entries(params).map(([name, value]) => [
				name,
				Array.isArray(value) ? value.join(' → ') : value
			])
		),
		// Forms by number follow the number in the message: the length of a text, or a count
		count: Number(params.length ?? params.count ?? 0)
	});
}
