export type Book = {
	id: string;
	title: string;
	author: string;
	isAvailable: boolean;
	location: string;
	permalink: string | null;
	returnDate: string | null;
	lastCheckedAt: string | null;
	scrapeError?: string | null;
};
