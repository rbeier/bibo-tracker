import { expect, test } from '@playwright/test';
import { checkAvailability } from '../src/lib/scraper/scraper.ts';
import type { Book } from '../src/types/models/book.ts';

test.describe('Application', () => {
	test('webserver test', async ({ page }) => {
		await page.goto('http://localhost:3000');
		await expect(page.getByRole('heading', { name: 'bibo.tracker' })).toBeVisible();
	});
});
