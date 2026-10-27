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
		headers.Title = /[^\x20-\x7E]/.test(title)
			? `=?UTF-8?B?${Buffer.from(title, 'utf-8').toString('base64')}?=`
			: title;
	}

	try {
		return await fetch(url, {
			method: 'POST',
			headers,
			body: message,
		});
	} catch (error) {
		console.error('Failed to send NTFY notification:', error);
	}
};

export const sendNotificationIfBookAvailable = async (book: Book, scraperResult: ScraperResult) => {
	if (!book.isAvailable && scraperResult.isAvailable) {
		return sendNotification(`📚 Buch jetzt verfügbar: ${book.title}`);
	}
};

export const sendScraperFailureNotification = async (book: Book, error: unknown) => {
	const reason = error instanceof Error ? error.message : String(error);
	return sendNotification(`⚠️ Konnte Buchinformationen nicht abrufen:\n${book.title}, ${book.author}\n${reason}`);
};

function formatBookList(prefix: string, books?: Array<{ title: string; author?: string }>, fallbackCount = 0): string {
	if (!books || books.length === 0) {
		return `${prefix} ${fallbackCount} ${fallbackCount === 1 ? 'Buch' : 'Bücher'}`;
	}
	const maxDisplay = 5;
	const lines = books.slice(0, maxDisplay).map((b) => `${prefix} ${b.title}${b.author ? ` (${b.author})` : ''}`);
	if (books.length > maxDisplay) {
		lines.push(`  ... und ${books.length - maxDisplay} weitere`);
	}
	return lines.join('\n');
}

export const sendBookListUpdatedNotification = async (summary: {
	added: number;
	removed: number;
	addedBooks?: Array<{ title: string; author?: string }>;
	removedBooks?: Array<{ title: string; author?: string }>;
}) => {
	if (summary.added === 0 && summary.removed === 0) {
		return;
	}

	const parts: string[] = [];

	if (summary.added > 0) {
		parts.push(formatBookList('+', summary.addedBooks, summary.added));
	}

	if (summary.removed > 0) {
		parts.push(formatBookList('-', summary.removedBooks, summary.removed));
	}

	const message = parts.join('\n\n');
	return sendNotification(message, '📚 Bücherliste aktualisiert');
};
