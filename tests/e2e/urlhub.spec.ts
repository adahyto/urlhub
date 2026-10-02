import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { API_PORT } from '../../playwright.config';

// The behaviour checked by hand before each release: sharing, live results, failures, the table and its tools,
// the 200-link limit, recent queries (nothing stored before the switch) and phones

const API = `http://127.0.0.1:${API_PORT}`;
const link = (path: string) => `https://example.test${path}`;

const field = (page: Page) => page.getByLabel('Enter URLs');
const summary = (page: Page) => page.locator('.toolbar__summary');
const lastRequest = async (page: Page) =>
	(await (await page.request.get(`${API}/__requests`)).json()).at(-1);

async function fetchLinks(page: Page, text: string) {
	await field(page).fill(text);
	await page.getByRole('button', { name: 'Fetch' }).click();
}

test.beforeEach(async ({ request }) => {
	await request.post(`${API}/__reset`);
});

test('a list with & and ? in its links survives sharing and a reload', async ({ page }) => {
	await page.goto('/');
	await fetchLinks(page, `see ${link('/a?x=1&y=2')}, and ${link('/b')}.`);
	await expect(summary(page)).toHaveText('2 links');
	await expect(page.locator('.tiles__title')).toHaveText(['Title of /a', 'Title of /b']);
	// The text went as typed; ldb-api found the links
	expect((await lastRequest(page)).text).toBe(`see ${link('/a?x=1&y=2')}, and ${link('/b')}.`);
	expect(new URL(page.url()).searchParams.get('urls')).toBe(`${link('/a?x=1&y=2')} ${link('/b')}`);

	await page.reload();
	await expect(field(page)).toHaveValue(`${link('/a?x=1&y=2')}\n${link('/b')}`);
	await expect(summary(page)).toHaveText('2 links');
});

test('old shared links with "-" between the links still open', async ({ page }) => {
	await page.goto(`/?urls=${link('/a')}-${link('/b')}`);
	await expect(page.locator('.tiles__title')).toHaveText(['Title of /a', 'Title of /b']);
});

test('results fill in as they come, and Stop marks the rest', async ({ page }) => {
	await page.goto('/');
	await fetchLinks(page, [link('/fast'), link('/slow-1'), link('/slow-2')].join('\n'));
	await expect(page.getByRole('button', { name: /Loading… 1 \/ 3/ })).toBeVisible();
	await page.getByRole('button', { name: 'Stop' }).click();
	await expect(page.locator('.tiles__error')).toHaveText(['stopped', 'stopped']);
	await expect(page.getByRole('button', { name: 'Fetch' })).toBeEnabled();
});

test('a failed link says why, and Retry asks again for the failed ones only', async ({ page }) => {
	await page.goto('/');
	await fetchLinks(page, [link('/ok'), link('/dead'), link('/flaky')].join(' '));
	await expect(summary(page)).toHaveText('3 links, 2 failed');
	await expect(page.locator('.tiles__error')).toHaveText(['host not found', 'timeout']);

	await page.getByRole('button', { name: 'Retry', exact: true }).click();
	await expect(summary(page)).toHaveText('3 links, 1 failed');
	expect((await lastRequest(page)).text).toBe(`${link('/dead')}\n${link('/flaky')}`);
	// Results go back to their places
	await expect(page.locator('.tiles__title')).toHaveText([
		'Title of /ok',
		'example.test',
		'Title of /flaky'
	]);
});

test('the table: advanced details, filters, sorting, JSON and CSV', async ({ page }) => {
	const urls = [link('/seo'), link('/video'), link('/dead'), link('/stars')];
	await page.goto(`/?urls=${encodeURIComponent(urls.join(' '))}&view=table&advanced=1`);
	await expect(summary(page)).toHaveText('4 links, 1 failed');
	expect((await lastRequest(page)).advanced).toBe(true);
	const rows = page.locator('tbody tr');
	await expect(rows).toHaveCount(4);
	await expect(page.locator('.table__seo .table__badge--warning')).toHaveText('1 SEO');
	await expect(rows.nth(3)).toContainText('★ 1.2k');

	await rows.first().getByRole('button', { name: 'Details' }).click();
	await expect(rows.first()).toContainText('Title is 72 characters (aim for at most 60).');

	await page.getByLabel('Show').selectOption('failed');
	await expect(rows).toHaveCount(1);
	await page.getByLabel('Show').selectOption('warnings');
	await expect(rows).toHaveCount(1);
	await page.getByLabel('Show').selectOption('all');
	await page.getByLabel('Type').selectOption('video');
	await expect(rows).toHaveCount(1);
	await page.getByLabel('Type').selectOption('');

	await page.getByRole('button', { name: /Duration/ }).click();
	await expect(rows.first().locator('.table__title')).toHaveText('A video');
	await expect(page.locator('th', { hasText: 'Duration' })).toHaveAttribute(
		'aria-sort',
		'descending'
	);

	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page
			.getByRole('button', { name: 'Export' })
			.click()
			.then(() => page.getByRole('button', { name: /Download CSV/ }).click())
	]);
	const csv = await readFile(await download.path(), 'utf8');
	expect(csv.charCodeAt(0)).toBe(0xfeff);
	const lines = csv.slice(1).split('\r\n');
	expect(lines[0]).toMatch(/^url,final_url,status,type,service,/);
	expect(lines).toHaveLength(5);

	await page.getByRole('button', { name: 'JSON', exact: true }).click();
	expect(new URL(page.url()).searchParams.get('view')).toBe('json');
	const json = JSON.parse(await page.getByRole('region', { name: 'Results as JSON' }).innerText());
	expect(json.urls).toHaveLength(4);

	await page.getByRole('button', { name: 'Tiles', exact: true }).click();
	await expect(page.locator('.tiles__item')).toHaveCount(4);
	const address = new URL(page.url()).searchParams;
	expect([address.get('view'), address.get('advanced')]).toEqual([null, null]);
	// Asking for the SEO details from the tiles opens the table, where they show
	await page.getByLabel('Advanced (SEO)').uncheck();
	await page.getByLabel('Advanced (SEO)').check();
	await expect(page.getByRole('button', { name: 'Table', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('more than 200 links: the form says so and the request is refused clearly', async ({
	page
}) => {
	await page.goto('/');
	const many = Array.from({ length: 201 }, (_, i) => link(`/${i}`)).join('\n');
	await field(page).fill(many);
	await expect(page.getByText('201 links — at most 200 at once')).toBeVisible();
	await page.getByRole('button', { name: 'Fetch' }).click();
	await expect(page.getByRole('alert')).toHaveText('At most 200 links per request, got 201.');
});

test('recent queries: nothing stored before the switch, deleted when it is turned off', async ({
	page
}) => {
	await page.goto('/');
	await fetchLinks(page, link('/a'));
	await expect(summary(page)).toHaveText('1 link');
	expect(await page.evaluate(() => localStorage.length)).toBe(0);

	const recentMenu = page.getByRole('button', { name: /^Recent/ });
	await recentMenu.click();
	await page.getByLabel('Remember recent queries on this device').check();
	await fetchLinks(page, `${link('/b')} ${link('/c')}`);
	await recentMenu.click();
	await expect(page.locator('.recent__open')).toHaveCount(1);
	await expect(page.locator('.recent__open')).toContainText('2 links · example.test');

	await page.reload();
	await recentMenu.click();
	await page.locator('.recent__open').click();
	await expect(field(page)).toHaveValue(`${link('/b')}\n${link('/c')}`);
	await expect(summary(page)).toHaveText('2 links');

	await recentMenu.click();
	await page.getByLabel('Remember recent queries on this device').uncheck();
	expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('on a phone the table does not scroll sideways', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const urls = [
		link('/seo'),
		link('/video'),
		link('/dead'),
		link('/a-very-long-path/that/goes/on/and/on?with=parameters&more=1')
	];
	await page.goto(`/?urls=${encodeURIComponent(urls.join(' '))}&view=table&advanced=1`);
	await expect(summary(page)).toHaveText('4 links, 1 failed');
	// Errors and SEO badges move into the row's text when the side column is hidden
	await expect(
		page.locator('.table__badges-inline').filter({ hasText: 'host not found' })
	).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('the status page shows urlhub and ldb-api up', async ({ page }) => {
	await page.goto('/status');
	await expect(page.locator('.check')).toHaveCount(2);
	await expect(page.locator('.check--down')).toHaveCount(0);
	await expect(page.getByText('Links per hour, last 24 hours')).toBeVisible();
});

test('Share copies the link that opens these results', async ({ page, context }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/');
	await fetchLinks(page, `${link('/a?x=1&y=2')} ${link('/video')}`);
	await expect(summary(page)).toHaveText('2 links');
	await page.getByRole('button', { name: 'Table', exact: true }).click();
	await page.getByRole('button', { name: 'Share' }).click();
	await page.getByRole('button', { name: /Copy link/ }).click();
	await expect(page.locator('.notice[role="status"]')).toHaveText(
		'Link copied: it opens these results'
	);
	const shared = new URL(await page.evaluate(() => navigator.clipboard.readText()));
	expect(shared.searchParams.get('urls')).toBe(`${link('/a?x=1&y=2')} ${link('/video')}`);
	expect(shared.searchParams.get('view')).toBe('table');

	await page.goto(shared.pathname + shared.search);
	await expect(page.locator('tbody tr')).toHaveCount(2);
});

test('the dark theme follows the system setting', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto(`/?urls=${link('/a')}&view=table`);
	await expect(summary(page)).toHaveText('1 link');
	const colours = await page.evaluate(() => ({
		page: getComputedStyle(document.body).backgroundColor,
		field: getComputedStyle(document.querySelector('textarea')!).backgroundColor,
		title: getComputedStyle(document.querySelector('.table__title')!).color
	}));
	expect(colours).toEqual({
		page: 'rgb(22, 22, 21)',
		field: 'rgb(34, 34, 33)',
		title: 'rgb(236, 236, 234)'
	});
});

test('the list can be edited: remove with undo, move with buttons and by dragging', async ({
	page
}) => {
	const titles = page.locator('.tiles__title');
	const urlsInAddress = () => new URL(page.url()).searchParams.get('urls');
	await page.goto('/');
	await fetchLinks(page, [link('/a'), link('/b'), link('/c')].join(' '));
	await expect(titles).toHaveText(['Title of /a', 'Title of /b', 'Title of /c']);

	const tile = (name: string) => page.locator('.tiles__item', { hasText: `Title of /${name}` });
	await tile('a').hover();
	await tile('a').getByRole('button', { name: 'Remove' }).click();
	await expect(titles).toHaveText(['Title of /b', 'Title of /c']);
	expect(urlsInAddress()).toBe(`${link('/b')} ${link('/c')}`);
	await expect(field(page)).toHaveValue(`${link('/b')}\n${link('/c')}`);
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(titles).toHaveText(['Title of /a', 'Title of /b', 'Title of /c']);
	expect(urlsInAddress()).toBe(`${link('/a')} ${link('/b')} ${link('/c')}`);

	await tile('a').getByRole('button', { name: 'Move later' }).click();
	await expect(titles).toHaveText(['Title of /b', 'Title of /a', 'Title of /c']);
	await tile('c').dragTo(tile('b'));
	await expect(titles).toHaveText(['Title of /c', 'Title of /b', 'Title of /a']);
	expect(urlsInAddress()).toBe(`${link('/c')} ${link('/b')} ${link('/a')}`);
	// Nothing was fetched again
	expect((await (await page.request.get(`${API}/__requests`)).json()).length).toBe(1);

	await page.getByRole('button', { name: 'Table', exact: true }).click();
	const rows = page.locator('tbody tr .table__title');
	await page.locator('tbody tr').first().getByRole('button', { name: 'Move down' }).click();
	await expect(rows).toHaveText(['Title of /b', 'Title of /c', 'Title of /a']);
	// A sorted or filtered table shows another order: rows can be removed there, not moved
	await page.getByRole('button', { name: /Title and details/ }).click();
	await expect(page.getByRole('button', { name: 'Move down' })).toHaveCount(0);
	await page.getByRole('button', { name: /Title and details/ }).click();
	await page.getByRole('button', { name: /Title and details/ }).click();
	await expect(page.getByRole('button', { name: 'Move down' })).toHaveCount(3);
	await page.getByPlaceholder('Filter by text, link or error').fill('/c');
	await expect(page.getByRole('button', { name: 'Move down' })).toHaveCount(0);
	await expect(page.locator('tbody').getByRole('button', { name: 'Remove' })).toHaveCount(1);
});

test('the list cannot be edited while a query fills it', async ({ page }) => {
	await page.goto('/');
	await fetchLinks(page, `${link('/fast')} ${link('/slow')}`);
	await expect(page.getByRole('button', { name: /Loading… 1 \/ 2/ })).toBeVisible();
	await expect(page.locator('.tiles__edit')).toHaveCount(0);
	await page.getByRole('button', { name: 'Stop' }).click();
	await expect(page.locator('.tiles__edit')).toHaveCount(2);
});

test('both dictionaries have the same texts with the same placeholders', async () => {
	const read = async (lang: string) =>
		JSON.parse(await readFile(new URL(`../../src/lib/i18n/${lang}.json`, import.meta.url), 'utf8'));
	type Tree = { [key: string]: string | Tree };
	const isPlural = (v: Tree) => 'one' in v && 'other' in v;
	const leaves = (tree: Tree, prefix = ''): [string, string][] =>
		Object.entries(tree).flatMap(([key, value]) =>
			typeof value === 'string' || isPlural(value)
				? [[prefix + key, JSON.stringify(value)] as [string, string]]
				: leaves(value, `${prefix}${key}.`)
		);
	const placeholders = (text: string) => [...new Set(text.match(/\{\w+\}/g) ?? [])].sort();
	const en = new Map(leaves(await read('en')));
	const pl = new Map(leaves(await read('pl')));
	expect([...pl.keys()].sort()).toEqual([...en.keys()].sort());
	for (const [key, text] of en) expect(placeholders(pl.get(key)!), key).toEqual(placeholders(text));
});

test.describe('in Polish', () => {
	test.use({ locale: 'pl-PL' });

	test('the browser language picks Polish; numbers, warnings and errors are Polish too', async ({
		page
	}) => {
		await page.goto('/');
		await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
		await expect(page.getByLabel('Wpisz linki')).toBeVisible();
		await page
			.getByLabel('Wpisz linki')
			.fill([link('/a'), link('/b'), link('/c'), link('/d'), link('/dead')].join(' '));
		await page.getByRole('button', { name: 'Pobierz' }).click();
		await expect(summary(page)).toHaveText('5 linków, nieudane: 1');
		await expect(page.locator('.tiles__error')).toHaveText('nie ma takiego serwera');

		await page.goto(
			`/?urls=${encodeURIComponent(`${link('/seo')} ${link('/b')}`)}&view=table&advanced=1`
		);
		await expect(summary(page)).toHaveText('2 linki');
		await page.getByRole('button', { name: 'Szczegóły', exact: true }).first().click();
		await expect(page.locator('.details')).toContainText(
			'Tytuł ma 72 znaki (zalecane najwyżej 60).'
		);
		await expect(page.getByRole('button', { name: 'Tabela', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
	});

	test('the switch changes the language and keeps the results; ?lang= wins over the browser', async ({
		page
	}) => {
		await page.goto(`/?urls=${link('/a')}`);
		await expect(summary(page)).toHaveText('1 link');
		await page.getByRole('link', { name: 'EN' }).click();
		await expect(page.getByRole('button', { name: 'Fetch' })).toBeVisible();
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await expect(summary(page)).toHaveText('1 link');
		expect(new URL(page.url()).searchParams.get('lang')).toBe('en');
		expect(new URL(page.url()).searchParams.get('urls')).toBe(link('/a'));
		// The results stayed; nothing was fetched again
		expect((await (await page.request.get(`${API}/__requests`)).json()).length).toBe(1);

		await page.goto('/?lang=en');
		await expect(page.getByRole('button', { name: 'Fetch' })).toBeVisible();
	});

	test('too many links are refused in Polish', async ({ page }) => {
		await page.goto('/');
		await page
			.getByLabel('Wpisz linki')
			.fill(Array.from({ length: 201 }, (_, i) => link(`/${i}`)).join('\n'));
		await expect(page.getByText('201 linków — najwyżej 200 naraz')).toBeVisible();
		await page.getByRole('button', { name: 'Pobierz' }).click();
		await expect(page.getByRole('alert')).toHaveText(
			'Najwyżej 200 linków w jednym zapytaniu, a jest 201.'
		);
	});
});

test('a short link opens the same list, and the same list gets the same link', async ({
	page,
	context
}) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto(`/?urls=${encodeURIComponent(`${link('/a?x=1&y=2')} ${link('/b')}`)}&view=table`);
	await expect(summary(page)).toHaveText('2 links');
	await page.getByRole('button', { name: 'Share' }).click();
	await page.getByRole('button', { name: /Short link/ }).click();
	await expect(page.locator('.notice[role="status"]')).toContainText(
		'Short link copied: http://127.0.0.1:4173/c/'
	);
	await expect(page.locator('.notice[role="status"]')).toContainText(
		'unused for 90 days, it is deleted'
	);
	const short = new URL(await page.evaluate(() => navigator.clipboard.readText()));
	expect(short.pathname).toMatch(/^\/c\/[0-9A-Za-z]{8}$/);

	// Only the list is kept: no address, no time beyond the file's own
	const id = short.pathname.slice(3);
	const stored = JSON.parse(await readFile(`test-results/data/collections/${id}.json`, 'utf8'));
	expect(stored).toEqual({
		urls: [link('/a?x=1&y=2'), link('/b')],
		view: 'table',
		advanced: false,
		lang: 'en'
	});

	await page.getByRole('button', { name: 'Share' }).click();
	await page.getByRole('button', { name: /Short link/ }).click();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(short.href);

	await page.goto(short.pathname);
	await expect(page.locator('tbody tr')).toHaveCount(2);
	const opened = new URL(page.url()).searchParams;
	expect([opened.get('urls'), opened.get('view'), opened.get('lang')]).toEqual([
		`${link('/a?x=1&y=2')} ${link('/b')}`,
		'table',
		'en'
	]);
});

test('an unknown short link says what happened, in both languages', async ({ page }) => {
	const response = await page.goto('/c/AAAAAAAA');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading')).toHaveText('This short link does not exist');
	await page.goto('/c/AAAAAAAA?lang=pl');
	await expect(page.getByRole('heading')).toHaveText('Ten krótki link nie istnieje');
	expect((await page.goto('/c/not-an-id!'))?.status()).toBe(404);
});

test('a shared link shows its list in messengers: Open Graph tags rendered by the server', async ({
	request
}) => {
	const meta = (html: string, name: string) =>
		new RegExp(`<meta (?:property|name)="${name}" content="([^"]*)"`)
			.exec(html)?.[1]
			?.replace(/&amp;/g, '&');
	const urls = [
		link('/a?x=1&y=2'),
		'https://www.github.com/x',
		'https://vimeo.com/1',
		'https://c.test/',
		'https://d.test/'
	];
	const address = `/?urls=${encodeURIComponent(urls.join(' '))}`;

	const en = await (await request.get(address, { headers: { 'accept-language': 'en-US' } })).text();
	expect(meta(en, 'og:title')).toBe('5 links: example.test, github.com, vimeo.com +2');
	expect(meta(en, 'og:description')).toBe(
		'example.test/a?x=1&y=2 · github.com/x · vimeo.com/1 · c.test/ … — Open them as tiles, a table or JSON on urlhub.'
	);
	expect(meta(en, 'og:image')).toBe('http://127.0.0.1:4173/og.png');
	expect(meta(en, 'twitter:card')).toBe('summary_large_image');
	expect(en).toContain('<title>5 links: example.test, github.com, vimeo.com +2 – urlhub</title>');

	const pl = await (await request.get(`${address}&lang=pl`)).text();
	expect(meta(pl, 'og:title')).toBe('5 linków: example.test, github.com, vimeo.com +2');
	expect(meta(pl, 'og:locale')).toBe('pl_PL');

	const plain = await (await request.get('/')).text();
	expect(meta(plain, 'og:title')).toBe('urlhub – link previews');
	expect((await request.get('/og.png')).headers()['content-type']).toBe('image/png');
});

test('the empty page explains itself, and "Try an example" fetches working examples in the page\'s language', async ({
	page
}) => {
	await page.goto('/?lang=pl');
	await expect(page.getByLabel('Wpisz linki')).toHaveValue('');
	await expect(
		page.getByRole('list', { name: 'Co robi urlhub' }).getByRole('listitem')
	).toHaveCount(3);
	await page.getByRole('button', { name: 'Wypróbuj przykład' }).click();
	await expect(summary(page)).toHaveText('6 linków');
	const sent = (await lastRequest(page)).text.split('\n');
	expect(sent).toContain('https://pl.wikipedia.org/wiki/Mars');
	expect(sent).toContain('https://kosmos.info.pl/pl/home');
	await expect(page.getByRole('list', { name: 'Co robi urlhub' })).toHaveCount(0);
});

test('menus open with the keyboard, move with the arrows and close with Escape', async ({
	page
}) => {
	await page.goto(`/?urls=${link('/a')}`);
	await expect(summary(page)).toHaveText('1 link');
	const exportMenu = page.getByRole('button', { name: 'Export' });
	await exportMenu.focus();
	await page.keyboard.press('Enter');
	await expect(exportMenu).toHaveAttribute('aria-expanded', 'true');
	await expect(page.getByRole('button', { name: 'Copy JSON' })).toBeFocused();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByRole('button', { name: 'Download JSON' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(exportMenu).toHaveAttribute('aria-expanded', 'false');
	await expect(exportMenu).toBeFocused();
});
