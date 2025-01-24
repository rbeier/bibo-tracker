import { Client } from '@notionhq/client';
import type { Book } from '../../types/models/book.ts';
import queryFilter from './query-filter.ts';

export function notionClient() {
	return new Client({ auth: process.env.NOTION_API_KEY });
}

export function queryBookList() {
	return notionClient().databases.query({
		database_id: process.env.NOTION_DATABASE_ID,
		filter: queryFilter,
	});
}

export async function updateBookStatus(book: Book, isAvailable: boolean) {
	return notionClient().pages.update({
		page_id: book.notionId,
		properties: {
			Verfügbar: {
				checkbox: isAvailable,
			},
		},
	});
}
