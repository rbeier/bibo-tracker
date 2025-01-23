import { DateTime } from 'luxon';

export type Book = {
	title: string;
	author: string;
	lastChecked: DateTime;
};
