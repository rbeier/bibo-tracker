import type {PageObjectResponse} from '@notionhq/client/build/src/api-endpoints';
import {queryBookList, updateBookStatus} from '../lib/notion/notion-connector.ts';
import {getBookInformation, launchBrowser} from '../lib/scraper/scraper.ts';
import {Store} from '../lib/store/store.ts';
import type {Book} from '../types/models/book.ts';
import {notionPageToBook} from '../util/mapper-util.ts';
import { sendNotificationIfBookAvailable, sendScraperFailureNotification } from '../lib/notification/notification.ts';
import type {ScraperResult} from "../types/models/scraper-result.ts";

export async function fetchBooks(): Promise<Book[]> {
	try {
		const response = await queryBookList();

		const results = response.results as PageObjectResponse[];
		return results.map(notionPageToBook);
	} catch (_e) {
		return [];
	}
}

export async function checkBooks() {
    console.log('Checking books...');
    const startTime = performance.now();
    const books = await fetchBooks();

    const context = await launchBrowser();
    const page = await context.newPage();

    for (const book of books) {
        let bookInformation: ScraperResult | undefined;
        console.log('Checking book:', book.title);

        try {
            bookInformation = await getBookInformation(page, book);
            console.log(`Book "${book.title}" is ${bookInformation.isAvailable ? 'available' : 'not available'}`);
        } catch (error) {
            console.error(`Error getting book information "${book.title}":`, error);
            await sendScraperFailureNotification(book, error);
        }

		if (bookInformation) {
            await sendNotificationIfBookAvailable(book, bookInformation);
            await updateBookStatus(book, bookInformation);
        }
    }

    console.log('Finished checking books');

    const runtimeMs = performance.now() - startTime;
    const timePerBookMs = books.length > 0 ? runtimeMs / books.length : 0;
    console.log(`Total runtime: ${(runtimeMs / 1000).toFixed(2)}s for ${books.length} book(s)`);
    console.log(`Time per book: ${(timePerBookMs / 1000).toFixed(2)}s`);

    await context.close();
    Store.updateLastChecked();
}
