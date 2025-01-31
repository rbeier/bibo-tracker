import type { DateTime } from 'luxon';

export type ScraperResult = {
	isAvailable: boolean;
	location: string | null;
	returnDate: DateTime | null;
};
