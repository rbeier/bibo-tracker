import { BookRepository } from '../lib/db/book-repository.ts';
import { sendNotificationIfBookAvailable, sendScraperFailureNotification } from '../lib/notification/notification.ts';
import { getBookInformation, launchBrowser } from '../lib/scraper/scraper.ts';
import type { Book } from '../types/models/book.ts';
import type { ScraperResult } from '../types/models/scraper-result.ts';

export type CheckBooksOptions = {
	bookIds?: string[];
};

let activeScrape = false;
let queuedFullScrape = false;
const queuedBookIds = new Set<string>();

export function isScraperRunning(): boolean {
	return activeScrape;
}

export async function fetchBooks(): Promise<Book[]> {
	return BookRepository.getAllBooks();
}

export async function checkBooks(options?: CheckBooksOptions): Promise<void> {
	if (activeScrape) {
		if (!options?.bookIds) {
			queuedFullScrape = true;
		} else {
			for (const id of options.bookIds) {
				queuedBookIds.add(id);
			}
		}
		console.log('Book check already running; queued follow-up check.');
		return;
	}

	activeScrape = true;

	try {
		await runScrapePass(options?.bookIds);

		while (queuedFullScrape || queuedBookIds.size > 0) {
			if (queuedFullScrape) {
				queuedFullScrape = false;
				queuedBookIds.clear();
				await runScrapePass(undefined);
			} else {
				const nextIds = Array.from(queuedBookIds);
				queuedBookIds.clear();
				await runScrapePass(nextIds);
			}
		}
	} finally {
		activeScrape = false;
	}
}

async function runScrapePass(bookIds?: string[]): Promise<void> {
	const isFullCheck = !bookIds;
	const books = bookIds ? BookRepository.getBooksByIds(bookIds) : BookRepository.getAllBooks();

	if (books.length === 0) {
		console.log('No books to check.');
		if (isFullCheck) {
			BookRepository.updateLastChecked();
		}
		return;
	}

	console.log(`Checking ${books.length} book(s)...`);
	const startTime = performance.now();

	const context = await launchBrowser();

	try {
		const page = await context.newPage();

		for (const book of books) {
			let bookInformation: ScraperResult | undefined;
			console.log('Checking book:', book.title);

			try {
				bookInformation = await getBookInformation(page, book);
				console.log(`Book "${book.title}" is ${bookInformation.isAvailable ? 'available' : 'not available'}`);
			} catch (error) {
				console.error(`Error getting book information "${book.title}":`, error);
				BookRepository.updateBookScraperError(book.id, error);
				await sendScraperFailureNotification(book, error);
			}

			if (bookInformation) {
				await sendNotificationIfBookAvailable(book, bookInformation);
				BookRepository.updateBookScraperStatus(book.id, bookInformation);
			}
		}

		console.log('Finished checking books');

		const runtimeMs = performance.now() - startTime;
		const timePerBookMs = books.length > 0 ? runtimeMs / books.length : 0;
		console.log(`Total runtime: ${(runtimeMs / 1000).toFixed(2)}s for ${books.length} book(s)`);
		console.log(`Time per book: ${(timePerBookMs / 1000).toFixed(2)}s`);

		if (isFullCheck || books.length === BookRepository.countBooks()) {
			BookRepository.updateLastChecked();
		}
	} finally {
		const browser = context.browser();
		await context.close();
		await browser?.close();
	}
}
