import type { Book } from '../../types/models/book.ts';
import type { ScraperResult } from '../../types/models/scraper-result.ts';

const sendNotification = async (message: string, title?: string) => {
	const url = `${Bun.env.NTFY_URL}/${Bun.env.NTFY_TOPIC}`;
	const token = Bun.env.NTFY_API_KEY;

	if (!Bun.env.NTFY_URL || !Bun.env.NTFY_TOPIC || !token) {
		return;
	}

	const headers: Record<string, string> = {
		Authorization: `Basic ${btoa(token)}`,
		'Content-Type': 'text/plain',
	};

	if (title) {
		headers.Title = title;
	}

	return fetch(url, {
		method: 'POST',
		headers,
		body: message,
	});
};

export const sendNotificationIfBookAvailable = async (book: Book, scraperResult: ScraperResult) => {
	if (!book.isAvailable && scraperResult.isAvailable) {
		return sendNotification(`📚 Buch jetzt verfügbar: ${book.title}`);
	}
};

export const sendScraperFailureNotification = async (book: Book, error: unknown) => {
	const reason = error instanceof Error ? error.message : String(error);
	return sendNotification(`⚠️ Konnte Buchinformationen nicht abrufen: ${book.title}\n${reason}`, 'Bibo-Tracker Fehler');
};

