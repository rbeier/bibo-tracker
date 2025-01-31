import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { queryBookList, updateBookStatus } from '../lib/notion/notion-connector.ts';
import { getBookInformation, launchBrowser } from '../lib/scraper/scraper.ts';
import { Store } from '../lib/store/store.ts';
import type { Book } from '../types/models/book.ts';
import { notionPageToBook } from '../util/mapper-util.ts';

export async function fetchBooks(): Promise<Book[]> {
	try {
		const response = await queryBookList();

		const results = response.results as PageObjectResponse[];
		return results.map(notionPageToBook);
	} catch (_e) {
		return [];
	}
}

export async function checkBooks() {
	console.log('Checking books...');
	const books = await fetchBooks();

	const context = await launchBrowser();
	const page = await context.newPage();

	for (const book of books) {
		const bookInformation = await getBookInformation(page, book);
		console.log(`Book ${book.title} is ${bookInformation.isAvailable ? 'available' : 'not available'}`);

		await updateBookStatus(book, bookInformation);
	}

	await context.close();
	Store.updateLastChecked();
}
