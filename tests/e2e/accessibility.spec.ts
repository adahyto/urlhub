import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// WCAG 2.2 AA (and axe's best practices) on every state of the pages: a change that breaks one fails CI

// Without motion: axe measures colours, and a menu still fading in (120 ms) would read as low contrast on a
// slow runner. People who ask their system for less motion see the pages exactly like this.
test.use({ contextOptions: { reducedMotion: 'reduce' } });

const link = (path: string) => `https://example.test${path}`;
const LIST = [link('/seo'), link('/video'), link('/dead'), link('/stars'), link('/a')];
const results = (extra = '') => `/?urls=${encodeURIComponent(LIST.join(' '))}${extra}`;

/** within: only that part of the page (an open menu covers what is under it, which axe would count against it) */
async function expectAccessible(page: Page, within?: string) {
	const builder = new AxeBuilder({ page }).withTags([
		'wcag2a',
		'wcag2aa',
		'wcag21a',
		'wcag21aa',
		'wcag22aa',
		'best-practice'
	]);
	const { violations } = await (within ? builder.include(within) : builder).analyze();
	const found = violations.map(
		(v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`
	);
	expect(found).toEqual([]);
}

const settled = (page: Page) =>
	expect(page.getByRole('button', { name: /^(Fetch|Pobierz)$/ })).toBeEnabled();

test('the empty page, light and dark', async ({ page }) => {
	await page.goto('/');
	await expectAccessible(page);
	await page.emulateMedia({ colorScheme: 'dark' });
	await expectAccessible(page);
});

test('tiles', async ({ page }) => {
	await page.goto(results());
	await settled(page);
	await expectAccessible(page);
});

test('the table with a row open', async ({ page }) => {
	await page.goto(results('&view=table&advanced=1'));
	await settled(page);
	await page.getByRole('button', { name: 'Details', exact: true }).first().click();
	await expectAccessible(page);
});

test('JSON and recent queries', async ({ page }) => {
	await page.goto(results('&view=json'));
	await settled(page);
	await page.getByRole('button', { name: /^Recent/ }).click();
	await page.getByLabel('Remember recent queries on this device').check();
	await expectAccessible(page);
	await page.getByRole('button', { name: 'Export' }).click();
	await expectAccessible(page, '.menu__list');
});

test('the dark theme', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto(results('&view=table&advanced=1'));
	await settled(page);
	await page.getByRole('button', { name: 'Details', exact: true }).first().click();
	await expectAccessible(page);
	await page.getByRole('button', { name: 'Tiles', exact: true }).click();
	await expectAccessible(page);
});

test('a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(results('&view=table'));
	await settled(page);
	await expectAccessible(page);
});

test('Polish', async ({ page }) => {
	await page.goto(results('&view=table&lang=pl'));
	await settled(page);
	await expectAccessible(page);
});

test('/status and a missing short link', async ({ page }) => {
	await page.goto('/status');
	await expectAccessible(page);
	await page.goto('/c/AAAAAAAA');
	await expectAccessible(page);
});

test('one announcement when a query starts and one when it ends, not one per result', async ({
	page
}) => {
	await page.goto('/');
	await page.getByLabel('Enter URLs').fill(`${link('/a')} ${link('/b')} ${link('/c')}`);
	await page.getByRole('button', { name: 'Fetch' }).click();
	const announcer = page.locator('p.sr-only[role="status"]');
	await expect(announcer).toHaveText('Done: 3 links, 0 failed.');
	await expect(page.locator('.toolbar__summary')).not.toHaveAttribute('aria-live');
});

test('the duration and issues columns show only when something fills them', async ({ page }) => {
	await page.goto(`/?urls=${encodeURIComponent(`${link('/a')} ${link('/b')}`)}&view=table`);
	await settled(page);
	await expect(page.locator('th', { hasText: 'Duration' })).toHaveCount(0);
	await expect(page.locator('th', { hasText: 'Issues' })).toHaveCount(0);
	await page.goto(results('&view=table'));
	await settled(page);
	await expect(page.locator('th', { hasText: 'Duration' })).toHaveCount(1);
	await expect(page.locator('th', { hasText: 'Issues' })).toHaveCount(1);
});
