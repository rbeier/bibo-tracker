import { expect, test } from '@playwright/test';
import { getBookInformation } from '../src/lib/scraper/scraper.ts';
import type { Book } from '../src/types/models/book.ts';

test.describe('Scraper Test', () => {
	test('should check book availability', async ({ page }) => {
		const book: Book = {
			title: 'Holly',
			author: 'Stephen King',
			notionId: '',
			location: '',
			isAvailable: false,
			permalink: '',
		};

		const bookInformation = await getBookInformation(page, book);

		console.log(bookInformation);

		expect(bookInformation).toBeDefined();
		expect(bookInformation.isAvailable).toEqual(expect.any(Boolean));
		expect(bookInformation.location).toStrictEqual(expect.any(String));
		expect(bookInformation.permalink).toStrictEqual(expect.any(String));
	});
});
