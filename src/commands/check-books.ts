import { updateBookStatus } from '../lib/notion/notion-connector.ts';
import { checkAvailability, launchBrowser } from '../lib/scraper/scraper.ts';
import { Store } from '../lib/store/store.ts';
import type { Book } from '../types/models/book.ts';

export async function checkBooks() {
	const books = Store.getItem<Book[]>('books');

	const context = await launchBrowser();
	const page = await context.newPage();

	for (const book of books) {
		const isAvailable = await checkAvailability(page, book);
		await updateBookStatus(book, isAvailable);
	}

	await context.close();
}
