import { expect } from '@playwright/test';
import { type Locator, type Page, chromium } from 'playwright';
import type { Book } from '../../types/models/book.ts';

export async function launchBrowser() {
	const browser = await chromium.launch({ headless: true });
	return await browser.newContext();
}

export async function checkAvailability(page: Page, book: Book) {
	await page.goto('https://katalog.halle.de/Mediensuche');
	await expect(page.getByRole('heading', { name: 'Suche' })).toBeVisible();

	const searchInput = page.getByRole('textbox', { name: 'Suchbegriff' });
	await searchInput.fill(`${book.title} ${book.author}`);

	await page.getByRole('combobox').first().selectOption({ index: 1 }); // Zweigstelle
	await page.getByText('Physische Medien').click(); // Medienart

	await page.getByRole('button', { name: 'Suchen' }).click();
	await page.waitForLoadState('networkidle');

	expect(page.url()).toContain('searchhash');

	const searchResults = page
		.getByRole('heading')
		.filter({ hasText: new RegExp(`^${book.title}$`) });

	for (const result of await searchResults.all()) {
		if (await getBookStatus(page, result)) {
			return true;
		}

		await page.goBack();
	}

	return false;
}

async function getBookStatus(page: Page, result: Locator): Promise<boolean> {
	await result.click();
	await expect(page.getByText('Exemplare')).toBeVisible();
	await expect(page.locator('.itemtype.book')).toBeVisible();

	const table = page.locator('div', { hasText: 'Exemplare' }).locator('table');
	const rows = table.locator('tbody').locator('tr', { hasText: 'Zentralbibo' });

	for (const row of await rows.all()) {
		const isAvailable = await row
			.filter({
				hasText: /Verfügbar|Heute zurückgegeben|In Einarbeitung/,
			})
			.count();

		if (isAvailable) {
			return true;
		}
	}

	return false;
}
