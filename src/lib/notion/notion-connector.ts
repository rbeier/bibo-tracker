// noinspection JSNonASCIINames,NonAsciiCharacters

import { Client } from '@notionhq/client';
import type { Book } from '../../types/models/book.ts';
import type { ScraperResult } from '../../types/models/scraper-result.ts';
import type { PageProperties } from '../../types/notion/page-properties.ts';
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

export async function updateBookStatus(book: Book, bookInformation: ScraperResult) {
	const properties: PageProperties = {
		Verfügbar: {
			checkbox: bookInformation.isAvailable,
		},
	};

	if (bookInformation.returnDate?.isValid) {
		properties.Rückgabedatum = {
			date: {
				start: bookInformation.returnDate.toISODate() as string,
			},
		};
	}

	if (bookInformation.location) {
		properties.Standort = {
			rich_text: [
				{
					text: {
						content: bookInformation.location,
					},
				},
			],
		};
	}

	return notionClient().pages.update({
		page_id: book.notionId,
		properties,
	});
}
