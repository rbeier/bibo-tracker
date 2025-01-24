import { Client } from '@notionhq/client';
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
