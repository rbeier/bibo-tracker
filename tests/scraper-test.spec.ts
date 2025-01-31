import { expect, test } from '@playwright/test';
import { getBookInformation } from '../src/lib/scraper/scraper.ts';
import type { Book } from '../src/types/models/book.ts';

test.describe('Scraper Test', () => {
	test('should check book availability', async ({ page }) => {
		const book: Book = {
			title: 'Die Mitternachtsbibliothek',
			author: 'Matt Haig',
			notionId: 'test',
			isAvailable: false,
		};

		const bookInformation = await getBookInformation(page, book);

		expect(bookInformation).toBeDefined();
		expect(bookInformation.isAvailable).toEqual(expect.any(Boolean));
		expect(bookInformation.location).not.toBeNull();
	});
});
