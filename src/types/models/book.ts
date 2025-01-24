import type { DateTime } from 'luxon';

export type Book = {
	title: string;
	author: string;
	notionId: string;
	lastChecked: DateTime | null;
};
