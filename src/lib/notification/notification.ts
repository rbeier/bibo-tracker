import type { Book } from '../../types/models/book.ts';
import type { ScraperResult } from '../../types/models/scraper-result.ts';

export const sendNotificationIfBookAvailable = async (book: Book, scraperResult: ScraperResult) => {
	const url = `${Bun.env.NTFY_URL}/${Bun.env.NTFY_TOPIC}`;
	const token = Bun.env.NTFY_TOKEN;

	if (url && token && !book.isAvailable && scraperResult.isAvailable) {
		return fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Basic ${btoa(token)}`,
				'Content-Type': 'text/plain',
			},
			body: `📚 Buch jetzt verfügbar: ${book.title}`,
		});
	}
};
