import { expect, test } from '@playwright/test';
import { API_PORT } from '../../playwright.config';
import {
	FEATURED,
	SHOWN_FIRST,
	featuredFor,
	inSeason,
	outOfSeason,
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
		const addresses = sets.flatMap((s) => [s.id, ...(s.aliases ?? [])]);
		expect(new Set(addresses).size).toBe(addresses.length);
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

test('a seasonal set shows only in its season, in the order of the file; a season may run over the new year', () => {
	expect(inSeason({ from: '10-01', to: '11-02' }, '10-01')).toBe(true);
	expect(inSeason({ from: '10-01', to: '11-02' }, '11-02')).toBe(true);
	expect(inSeason({ from: '10-01', to: '11-02' }, '11-03')).toBe(false);
	expect(inSeason({ from: '12-20', to: '01-31' }, '12-31')).toBe(true);
	expect(inSeason({ from: '12-20', to: '01-31' }, '01-15')).toBe(true);
	expect(inSeason({ from: '12-20', to: '01-31' }, '02-01')).toBe(false);

	for (const lang of ['en', 'pl'] as const) {
		const all = FEATURED.filter((s) => s.lang === lang);
		for (const day of ['01-15', '04-15', '07-15', '10-15']) {
			const shown = featuredFor(lang, day);
			// The file's order, without the sets out of season, which are the archive
			expect(shown).toEqual(all.filter((s) => !s.season || inSeason(s.season, day)));
			expect([...shown, ...outOfSeason(lang, day)].length).toBe(all.length);
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
	await expect(page.getByText(`Title of ${new URL(set.urls[0]).pathname}`).first()).toBeVisible();
	if (set.intro) await expect(page.getByText(set.intro)).toBeVisible();
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', set.title);

	// It joins Recent, and "Edit a copy" makes it an ordinary list on the home page
	await page.getByRole('link', { name: 'Edytuj kopię' }).click();
	await expect(page.getByLabel('Linki', { exact: true })).toHaveValue(set.urls.join('\n'));
	await page.getByRole('button', { name: /^Ostatnie/ }).click();
	await expect(page.locator('.recent__open').first()).toContainText(`${set.urls.length} link`);
});

test("a set's page is made for search engines: links in the HTML, canonical, languages, JSON-LD", async ({
	request
}) => {
	const set = FEATURED.find((s) => s.lang === 'pl' && s.alternate)!;
	const html = await (
		await request.get(`/s/pl/${set.id}`, { headers: { 'accept-language': 'en' } })
	).text();
	// Served with its links' details, read by the server
	expect(html).toContain(`Title of ${new URL(set.urls[0]).pathname}`);
	// In the set's language, whatever the browser's
	expect(html).toMatch(/<html lang="pl"/);
	expect(html).toMatch(/<meta name="robots" content="index, follow"/);
	const O = 'http://127.0.0.1:4173';
	expect(html).toContain(`<link rel="canonical" href="${O}/s/pl/${set.id}"`);
	expect(html).toContain(`hreflang="en" href="${O}/s/en/${set.alternate}"`);
	const ld = JSON.parse(/<script type="application\/ld\+json">([^<]+)<\/script>/.exec(html)![1]);
	expect(ld['@type']).toBe('CollectionPage');
	expect(ld.mainEntity.numberOfItems).toBe(set.urls.length);
	expect(ld.mainEntity.itemListElement[0].url).toBe(set.urls[0]);

	// Published lists stay out of search results
	const res = await request.post('/api/lists', {
		data: { title: 'Mine', urls: [set.urls[0]], view: 'tiles', lang: 'pl' }
	});
	const own = await (await request.get((await res.json()).path)).text();
	expect(own).toMatch(/<meta name="robots" content="noindex, follow"/);
});

test('an earlier address of a set leads to its address now', async ({ page }) => {
	const set = FEATURED.find((s) => s.lang === 'pl' && s.aliases?.length)!;
	const res = await page.request.get(`/s/pl/${set.aliases![0]}?lang=pl`, { maxRedirects: 0 });
	expect(res.status()).toBe(301);
	expect(res.headers()['location']).toBe(`/s/pl/${set.id}?lang=pl`);
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

test('all sets have a page: the ones of now, then the archive, linked from the home page', async ({
	page
}) => {
	await page.goto('/?lang=pl');
	await page.getByRole('link', { name: 'Wszystkie zestawy →' }).click();
	await expect(page).toHaveURL(/\/s\/pl\?lang=pl$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Zestawy linków do udostępniania'
	);
	const now = featuredFor('pl', todayInPoland());
	const archive = outOfSeason('pl', todayInPoland());
	await expect(page.getByRole('region', { name: 'Na teraz' }).getByRole('link')).toHaveCount(
		now.length
	);
	await expect(page.getByRole('region', { name: 'Poza sezonem' })).toHaveCount(
		archive.length ? 1 : 0
	);

	// A set's page leads back through it
	await page.getByRole('region', { name: 'Na teraz' }).getByRole('link').first().click();
	const crumbs = page.getByRole('navigation', { name: 'Ścieżka' });
	await expect(crumbs.getByRole('link')).toHaveText(['urlhub', 'Zestawy linków do udostępniania']);
	await crumbs.getByRole('link', { name: 'Zestawy linków do udostępniania' }).click();
	await expect(page).toHaveURL(/\/s\/pl\?lang=pl$/);

	expect((await page.request.get('/s/de')).status()).toBe(404);
	const sitemap = await (await page.request.get('/sitemap.xml')).text();
	expect(sitemap).toContain('/s/pl</loc>');
	expect(sitemap).toContain('/s/en</loc>');
});

test('urlhub installs as an app; there, a set page has a way back', async ({ page, request }) => {
	const manifest = await (await request.get('/manifest.webmanifest')).json();
	expect(manifest).toMatchObject({ short_name: 'urlhub', start_url: '/', display: 'standalone' });
	for (const icon of manifest.icons)
		expect((await request.get(icon.src)).headers()['content-type']).toBe('image/png');

	// In a browser tab the browser has its own back button
	await page.goto('/?lang=pl');
	const back = page.getByRole('button', { name: 'Wróć' });
	await page.getByRole('region', { name: 'Polecane zestawy' }).getByRole('link').first().click();
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(back).toBeHidden();

	// As an app (iOS marks it like this before the page shows): back where it came from
	await page.evaluate(() => document.documentElement.classList.add('is-standalone'));
	await back.click();
	await expect(page).toHaveURL(/\/\?lang=pl$/);
	await expect(back).toHaveCount(0);

	// Opened straight from a link: back to the home page
	const set = featuredFor('pl', todayInPoland())[0];
	await page.goto(`/s/pl/${set.id}?lang=pl`);
	await page.evaluate(() => document.documentElement.classList.add('is-standalone'));
	await page.getByRole('button', { name: 'Wróć' }).click();
	await expect(page).toHaveURL(/\/\?lang=pl$/);
});
