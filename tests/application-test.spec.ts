import { expect, test } from '@playwright/test';
import { sendNotificationIfBookAvailable } from '../src/lib/notification/notification.ts';
import type { Book } from '../src/types/models/book.ts';
import type { ScraperResult } from '../src/types/models/scraper-result.ts';

test.describe('Application', () => {
	test('webserver and health check test', async ({ page, request }) => {
		const healthResponse = await request.get('http://localhost:3000/api/health');
		expect(healthResponse.ok()).toBeTruthy();
		const healthJson = await healthResponse.json();
		expect(healthJson.status).toBe('ok');

		await page.goto('http://localhost:3000');
		await expect(page.getByText('verfügbar')).toBeVisible();
	});

	test('sync endpoint rejects unauthenticated requests and syncs books when API_KEY is provided', async ({
		page,
		request,
	}) => {
		const unauthRes = await request.post('http://localhost:3000/api/books?skipScrape=true', {
			data: { books: [{ id: 'e2e-1', title: 'Holly', author: 'Stephen King' }] },
		});
		expect([401, 503]).toContain(unauthRes.status());

		const apiKey = process.env.API_KEY;
		if (!apiKey) {
			return;
		}

		const syncRes = await request.post('http://localhost:3000/api/books?skipScrape=true', {
			headers: { Authorization: `Bearer ${apiKey}` },
			data: {
				books: [{ id: 'e2e-1', title: 'Holly', author: 'Stephen King' }],
			},
		});
		expect(syncRes.ok()).toBeTruthy();

		await page.goto('http://localhost:3000');
		await expect(page.getByText('Holly')).toBeVisible();
		await expect(page.getByText('Stephen King')).toBeVisible();

		// Clean up synced test book
		const clearRes = await request.post('http://localhost:3000/api/books?skipScrape=true', {
			headers: { Authorization: `Bearer ${apiKey}` },
			data: { books: [], allowEmpty: true },
		});
		expect(clearRes.ok()).toBeTruthy();
	});

	// skip test in CI to not send a notification every time
	test.skip('should send notification if book becomes available', async () => {
		const mockBook: Book = {
			id: '123',
			title: 'Test Book',
			isAvailable: false,
			permalink: '',
			location: '',
			author: '',
			returnDate: null,
			lastCheckedAt: null,
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
