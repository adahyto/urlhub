import { expect, test } from '@playwright/test';
import { API_PORT } from '../../playwright.config';
import {
	FEATURED,
	SHOWN_FIRST,
	featuredFor,
	inSeason,
	todayInPoland
} from '../../src/lib/featured';

// The featured sets of the home page (src/lib/featured.json): the file itself, the seasons, and opening a set

const API = `http://127.0.0.1:${API_PORT}`;
// A card's name starts with the set's title
const named = (title: string) => new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

test.beforeEach(async ({ request }) => {
	await request.post(`${API}/__reset`);
});

test('the featured sets are well formed, in both languages', () => {
	for (const lang of ['en', 'pl'] as const) {
		const sets = FEATURED.filter((s) => s.lang === lang);
		// Something to offer on every day of the year
		expect(sets.filter((s) => !s.season).length).toBeGreaterThanOrEqual(1);
		expect(new Set(sets.map((s) => s.id)).size).toBe(sets.length);
	}
	for (const set of FEATURED) {
		expect(set.id).toMatch(/^[a-z0-9-]+$/);
		expect(['tiles', 'table']).toContain(set.view);
		expect(set.title.trim()).not.toBe('');
		expect(set.description.trim()).not.toBe('');
		expect(set.urls.length).toBeGreaterThanOrEqual(3);
		expect(set.urls.length).toBeLessThanOrEqual(200);
		expect(new Set(set.urls).size).toBe(set.urls.length);
		for (const url of set.urls) expect(url).toMatch(/^https:\/\/[^\s]+$/);
		expect(set.covers?.length ?? 0).toBeLessThanOrEqual(3);
		for (const src of set.covers ?? []) expect(src).toMatch(/^https?:\/\/[^\s]+$/);
		if (set.season) {
			expect(set.season.from).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
			expect(set.season.to).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
		}
	}
});

test('a seasonal set shows only in its season, first; a season may run over the new year', () => {
	expect(inSeason({ from: '10-01', to: '11-02' }, '10-01')).toBe(true);
	expect(inSeason({ from: '10-01', to: '11-02' }, '11-02')).toBe(true);
	expect(inSeason({ from: '10-01', to: '11-02' }, '11-03')).toBe(false);
	expect(inSeason({ from: '12-20', to: '01-31' }, '12-31')).toBe(true);
	expect(inSeason({ from: '12-20', to: '01-31' }, '01-15')).toBe(true);
	expect(inSeason({ from: '12-20', to: '01-31' }, '02-01')).toBe(false);

	for (const lang of ['en', 'pl'] as const) {
		const seasonal = FEATURED.filter((s) => s.lang === lang && s.season);
		const always = FEATURED.filter((s) => s.lang === lang && !s.season);
		for (const set of seasonal) {
			const during = featuredFor(lang, set.season!.from);
			// In season: among the first ones, before every set without a season
			expect(during.indexOf(set)).toBeGreaterThanOrEqual(0);
			expect(during.indexOf(set)).toBeLessThan(during.length - always.length);
		}
		for (const day of ['01-15', '04-15', '07-15', '10-15']) {
			const sets = featuredFor(lang, day);
			expect(sets.filter((s) => s.season && !inSeason(s.season, day))).toEqual([]);
			expect(sets.filter((s) => !s.season)).toEqual(always);
		}
	}
});

test('the empty page offers featured sets; each opens as a page with its title and no form', async ({
	page
}) => {
	await page.goto('/?lang=pl');
	const region = page.getByRole('region', { name: 'Polecane zestawy' });
	const cards = region.getByRole('listitem');
	const total = featuredFor('pl', todayInPoland()).length;
	await expect(cards).toHaveCount(Math.min(total, SHOWN_FIRST));

	if (total > SHOWN_FIRST) {
		const more = region.getByRole('button', { name: /Więcej zestawów/ });
		await expect(more).toHaveAttribute('aria-expanded', 'false');
		await more.click();
		await expect(cards).toHaveCount(total);
		await expect(region.getByRole('button', { name: 'Mniej zestawów' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
	}

	// The cards' pictures come through /img, small, never straight from other sites
	for (const set of featuredFor('pl', todayInPoland()).slice(0, SHOWN_FIRST)) {
		const card = region.getByRole('link', { name: named(set.title) });
		const pictures = card.locator('img');
		await expect(pictures).toHaveCount(set.covers?.length ?? 0);
		for (const src of await pictures.evaluateAll((all) => all.map((i) => i.getAttribute('src'))))
			expect(src).toMatch(/^\/img\?u=.+&w=240&s=/);
	}

	const set = featuredFor('pl', todayInPoland()).at(-1)!;
	await region.getByRole('link', { name: named(set.title) }).click();
	await expect(page).toHaveURL(new RegExp(`/s/pl/${set.id}\\?lang=pl$`));
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(set.title);
	await expect(page.getByText(set.description)).toBeVisible();
	await expect(page.getByLabel('Linki', { exact: true })).toHaveCount(0);
	await expect(
		page.getByRole('button', { name: set.view === 'table' ? 'Tabela' : 'Kafelki' })
	).toHaveAttribute('aria-pressed', 'true');
	// The details are read now, through the same proxy as the home page
	await expect(page.getByText(`Title of ${new URL(set.urls[0]).pathname}`).first()).toBeVisible();
	const sent = (await (await page.request.get(`${API}/__requests`)).json()).at(-1);
	expect(sent.text.split('\n')).toEqual(set.urls);
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', set.title);

	// It joins Recent, and "Edit a copy" makes it an ordinary list on the home page
	await page.getByRole('link', { name: 'Edytuj kopię' }).click();
	await expect(page.getByLabel('Linki', { exact: true })).toHaveValue(set.urls.join('\n'));
	await page.getByRole('button', { name: /^Ostatnie/ }).click();
	await expect(page.locator('.recent__open').first()).toContainText(`${set.urls.length} link`);
});

test('a featured set that is gone says so', async ({ page }) => {
	const res = await page.goto('/s/pl/nie-ma-takiego?lang=pl');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tego zestawu już nie ma');
});

test('the English page has its own sets', async ({ page }) => {
	await page.goto('/?lang=en');
	const region = page.getByRole('region', { name: 'Featured sets' });
	const first = featuredFor('en', todayInPoland())[0];
	await expect(region.getByRole('link', { name: named(first.title) })).toBeVisible();
	const english = FEATURED.filter((s) => s.lang === 'en').map((s) => s.title);
	for (const set of FEATURED.filter((s) => s.lang === 'pl' && !english.includes(s.title))) {
		await expect(region.getByText(set.title, { exact: true })).toHaveCount(0);
	}
});
