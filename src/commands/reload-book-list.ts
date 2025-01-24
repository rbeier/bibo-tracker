import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import { queryBookList } from '../lib/notion/notion-connector.ts';
import { notionPageToBook } from '../util/mapper-util.ts';
import { updateBooksInStore } from '../util/models/book-util.ts';

export async function reloadBookList() {
	const response = await queryBookList();

	const results = response.results as PageObjectResponse[];
	const books = results.map(notionPageToBook);

	await updateBooksInStore(books);

	console.log('book list refreshed');
}
