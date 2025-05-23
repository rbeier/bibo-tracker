import { expect, test } from '@playwright/test';
import { sendNotificationIfBookAvailable } from '../src/lib/notification/notification.ts';
import type { Book } from '../src/types/models/book.ts';
import type { ScraperResult } from '../src/types/models/scraper-result.ts';

test.describe('Application', () => {
	test('webserver test', async ({ page }) => {
		await page.goto('http://localhost:3000');
		await expect(page.getByRole('heading', { name: 'bibo.tracker' })).toBeVisible();
	});

	// skip test in CI to not send a notification every time
	test.skip('should send notification if book becomes available', async () => {
		const mockBook: Book = {
			notionId: '123',
			title: 'Test Book',
			isAvailable: false,
			permalink: '',
			location: '',
			author: '',
		};

		const mockScraperResult: ScraperResult = {
			isAvailable: true,
			returnDate: null,
			location: null,
			permalink: null,
		};

		const response = await sendNotificationIfBookAvailable(mockBook, mockScraperResult);
		expect(response?.ok).toBeTruthy();
	});
});
