import { expect, test, type Page } from '@playwright/test';
import { API_PORT } from '../../playwright.config';

// Saved lists (/l/<id>, src/lib/server/lists.ts): a title, a snapshot taken by the server, and no way to change them

const API = `http://127.0.0.1:${API_PORT}`;
const link = (path: string) => `https://example.test${path}`;

test.beforeEach(async ({ request }) => {
	await request.post(`${API}/__reset`);
});

const save = (page: Page, data: Record<string, unknown>) =>
	page.request.post('/api/lists', { data: { view: 'tiles', lang: 'en', ...data } });

test('a saved list is a page of its own: its title, the links as saved, no form', async ({
	page
}) => {
	const urls = [link('/a'), link('/video')];
	const res = await save(page, {
		title: '  Two   links ',
		description: 'For the tests',
		urls,
		// Details from the browser are not taken: the server reads the links itself
		items: [{ url: link('/a'), title: 'Made up' }]
	});
	expect(res.status()).toBe(200);
	const { id, path } = await res.json();
	expect(path).toBe(`/l/${id}`);

	await page.goto(path);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Two links');
	await expect(page.getByText('For the tests')).toBeVisible();
	await expect(page.getByText(/^2 links · saved /)).toBeVisible();
	await expect(page.getByLabel('Links', { exact: true })).toHaveCount(0);
	await expect(page.getByText('Title of /a').first()).toBeVisible();
	await expect(page.getByText('Made up')).toHaveCount(0);
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
	await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'Two links');
	// Nothing to change it with
	await expect(page.getByRole('button', { name: /remove/i })).toHaveCount(0);

	await page.getByRole('button', { name: 'Table' }).click();
	await expect(page.getByRole('table')).toBeVisible();

	await page.getByRole('link', { name: 'Edit a copy' }).click();
	await expect(page.getByLabel('Links', { exact: true })).toHaveValue(urls.join('\n'));
	await expect(page.locator('.toolbar__summary')).toHaveText('2 links');
});

test('the same list keeps its address, any change gets a new one, and the snapshot stays', async ({
	page
}) => {
	const first = await (await save(page, { title: 'Mine', urls: [link('/a')] })).json();
	const again = await (await save(page, { title: 'Mine', urls: [link('/a')] })).json();
	expect(again.id).toBe(first.id);
	const changed = await (await save(page, { title: 'Mine!', urls: [link('/a')] })).json();
	expect(changed.id).not.toBe(first.id);
	// Saving the same list again does not read the links again
	const requests = await (await page.request.get(`${API}/__requests`)).json();
	expect(requests).toHaveLength(2);
});

test('a list needs a title of at most 80 characters and real links', async ({ page }) => {
	expect((await save(page, { title: ' ', urls: [link('/a')] })).status()).toBe(400);
	expect((await save(page, { title: 'x'.repeat(81), urls: [link('/a')] })).status()).toBe(400);
	expect(
		(await save(page, { title: 'ok', description: 'd'.repeat(301), urls: [link('/a')] })).status()
	).toBe(400);
	expect((await save(page, { title: 'ok', urls: ['javascript:alert(1)'] })).status()).toBe(400);
	expect((await save(page, { title: 'ok', urls: [] })).status()).toBe(400);
});

test('an unknown saved list says what happened, in both languages', async ({ page }) => {
	const res = await page.goto('/l/AAAAAAAA');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'This saved list does not exist'
	);
	await page.goto('/l/AAAAAAAA?lang=pl');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Ta zapisana lista nie istnieje'
	);
});

test('a saved list has a way to report it', async ({ page }) => {
	const { path } = await (await save(page, { title: 'Report me', urls: [link('/a')] })).json();
	await page.goto(path);
	const report = page.getByRole('link', { name: 'Report abuse' });
	await expect(report).toHaveAttribute(
		'href',
		/^mailto:.+\?subject=Report%20of%20a%20urlhub%20list/
	);
});
