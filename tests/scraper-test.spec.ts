import { expect, test } from '@playwright/test';
import type { Locator, Page } from 'playwright';

test.describe('Scraper Test', () => {
	const bookTitle = 'Die Mitternachtsbibliothek';
	const author = 'Matt Haig';

	test.beforeEach(async ({ page }) => {
		await page.goto('https://katalog.halle.de/Mediensuche');
	});

	test('should visit search page', async ({ page }) => {
		let availability = false;

		await expect(page.getByRole('heading', { name: 'Suche' })).toBeVisible();

		const searchInput = page.getByRole('textbox', { name: 'Suchbegriff' });
		await searchInput.fill(`${bookTitle} ${author}`);

		await page.getByRole('combobox').first().selectOption({ index: 1 }); // Zweigstelle
		await page.getByText('Physische Medien').click(); // Medienart

		await page.getByRole('button', { name: 'Suchen' }).click();
		await page.waitForLoadState('networkidle');

		expect(page.url()).toContain('searchhash');

		const searchResults = page
			.getByRole('heading')
			.filter({ hasText: new RegExp(`^${bookTitle}$`) });

		for (const result of await searchResults.all()) {
			if (await checkBookAvailability(page, result)) {
				availability = true;
				console.log(`Book is available: ${availability}`);
				break;
			}

			await page.goBack();
		}

		if (!availability) {
			console.log('Book is not available');
		}
	});

	const checkBookAvailability = async (
		page: Page,
		result: Locator,
	): Promise<boolean> => {
		await result.click();
		await expect(page.getByText('Exemplare')).toBeVisible();
		await expect(page.locator('.itemtype.book')).toBeVisible();

		const table = page
			.locator('div', { hasText: 'Exemplare' })
			.locator('table');

		const rows = table
			.locator('tbody')
			.locator('tr', { hasText: 'Zentralbibo' });

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
	};
});
