import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { queryBookList, updateBookStatus } from '../lib/notion/notion-connector.ts';
import { checkAvailability, launchBrowser } from '../lib/scraper/scraper.ts';
import type { Book } from '../types/models/book.ts';
import { notionPageToBook } from '../util/mapper-util.ts';

async function fetchBooks(): Promise<Book[]> {
	const response = await queryBookList();

	const results = response.results as PageObjectResponse[];
	return results.map(notionPageToBook);
}

export async function checkBooks() {
	const books = await fetchBooks();

	const context = await launchBrowser();
	const page = await context.newPage();

	for (const book of books) {
		const isAvailable = await checkAvailability(page, book);
		console.log(`Book ${book.title} is available: ${isAvailable}`);

		await updateBookStatus(book, isAvailable);
	}

	await context.close();
}
