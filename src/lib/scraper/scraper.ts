import { expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { type Locator, type Page, chromium } from 'playwright';
import type { Book } from '../../types/models/book.ts';
import type { ScraperResult } from '../../types/models/scraper-result.ts';
import { ScraperUtil, developmentScraperResult, newScraperResult } from './scraper-util.ts';

let scraperUtil: ScraperUtil;

export async function launchBrowser() {
	const browser = await chromium.launch({ headless: true });
	return await browser.newContext();
}

export async function getBookInformation(page: Page, book: Book): Promise<ScraperResult> {
	scraperUtil = new ScraperUtil(page);

	const returnDates: DateTime[] = [];
	let bookData = newScraperResult();

	// we should not stress the bibo website in development
	if (process.env?.ENVIRONMENT === 'development') {
		return Promise.resolve(developmentScraperResult());
	}

	await page.goto('https://katalog.halle.de/Mediensuche');
	await expect(page.getByRole('heading', { name: 'Suche' })).toBeVisible();

	await scraperUtil.fillSearchForm(book);
	await scraperUtil.searchForBook();
	expect(page.url()).toContain('searchhash');

	const searchResults = await page
		.getByRole('heading')
		.filter({ hasText: new RegExp(`^${book.title.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')}$`) })
		.all();

	expect(searchResults.length).toBeGreaterThanOrEqual(1);

	for (const result of searchResults) {
		bookData = await extractData(page, result);

		if (bookData.isAvailable) {
			return bookData; // book is available, no need to check potential other results
		}

		if (bookData.returnDate instanceof DateTime) {
			returnDates.push(bookData.returnDate);
		}

		await page.goBack();
	}

	return {
		...bookData,
		returnDate: DateTime.min(...returnDates),
	};
}

async function extractData(page: Page, result: Locator): Promise<ScraperResult> {
	const returnDates: DateTime[] = [];
	let bookData = newScraperResult();

	await result.click();
	await expect(page.getByText('Exemplare')).toBeVisible();
	await expect(page.locator('.itemtype.book')).toBeVisible();

	for (const row of await scraperUtil.getTableRows()) {
		bookData = await parseDataFromRow(row);

		if (bookData.isAvailable) {
			return bookData;
		}

		if (bookData.returnDate instanceof DateTime) {
			returnDates.push(bookData.returnDate);
		}
	}

	return {
		...bookData,
		returnDate: DateTime.min(...returnDates),
	};
}

async function parseDataFromRow(row: Locator): Promise<ScraperResult> {
	const cells = await row.locator('td').all();

	const status = await cells[4].innerText();
	const returnDate = await cells[5].innerText();

	return {
		location: await scraperUtil.getBookLocation(),
		isAvailable: status ? new RegExp(/Verfügbar|Heute zurückgegeben|In Einarbeitung/).test(status) : false,
		returnDate: returnDate ? DateTime.fromFormat(returnDate, 'dd.MM.yyyy', { locale: 'de' }) : null,
	};
}
