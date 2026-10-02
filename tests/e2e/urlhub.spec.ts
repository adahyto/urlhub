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

	await page.getByRole('button', { name: 'Retry 2 failed' }).click();
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
	await expect(rows.nth(3)).toContainText('★ 1.2K');

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
		page.getByRole('button', { name: 'Download CSV' }).click()
	]);
	const csv = await readFile(await download.path(), 'utf8');
	expect(csv.charCodeAt(0)).toBe(0xfeff);
	const lines = csv.slice(1).split('\r\n');
	expect(lines[0]).toMatch(/^url,final_url,status,type,service,/);
	expect(lines).toHaveLength(5);

	await page.getByRole('tab', { name: 'JSON' }).click();
	expect(new URL(page.url()).searchParams.get('view')).toBe('json');
	const json = JSON.parse(await page.getByRole('region', { name: 'Results as JSON' }).innerText());
	expect(json.urls).toHaveLength(4);

	await page.getByRole('tab', { name: 'Tiles' }).click();
	await expect(page.locator('.tiles__item')).toHaveCount(4);
	await expect(page.getByLabel(/Advanced:/)).toHaveCount(0);
	const address = new URL(page.url()).searchParams;
	expect([address.get('view'), address.get('advanced')]).toEqual([null, null]);
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

	await page.locator('summary', { hasText: 'Recent queries' }).click();
	await page.getByLabel('Remember recent queries on this device').check();
	await fetchLinks(page, `${link('/b')} ${link('/c')}`);
	await expect(page.locator('.recent__open')).toHaveCount(1);
	await expect(page.locator('.recent__open')).toContainText('2 links · example.test');

	await page.reload();
	await page.locator('summary', { hasText: 'Recent queries' }).click();
	await page.locator('.recent__open').click();
	await expect(field(page)).toHaveValue(`${link('/b')}\n${link('/c')}`);
	await expect(summary(page)).toHaveText('2 links');

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
	await page.getByRole('tab', { name: 'Table' }).click();
	await page.getByRole('button', { name: 'Share' }).click();
	await expect(page.getByRole('status')).toHaveText('Link copied: it opens these results');
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

	await page.getByRole('tab', { name: 'Table' }).click();
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
