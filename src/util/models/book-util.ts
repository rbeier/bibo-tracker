import { Store } from '../../lib/store/store.ts';
import type { Book } from '../../types/models/book.ts';

export async function updateBooksInStore(newBooks: Book[]) {
	const existingBooks = Store.getItem<Book[]>('books');

	const mergedBooks = newBooks.map((newBook) => {
		const existingBook = existingBooks.find(
			(book) => book.notionId === newBook.notionId,
		);

		return {
			...newBook,
			lastChecked: existingBook?.lastChecked || null,
		};
	});

	await Store.setItem('books', mergedBooks);
}
