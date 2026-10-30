import { expect } from '@playwright/test';
import { DateTime } from 'luxon';
import { type Locator, type Page, chromium } from 'playwright';
import type { Book } from '../../types/models/book.ts';
import type { ScraperResult } from '../../types/models/scraper-result.ts';
import { ScraperUtil, buildTitleRegex, newScraperResult } from './scraper-util.ts';

let scraperUtil: ScraperUtil;

export async function launchBrowser() {
	const browser = await chromium.launch({ headless: true });
	return await browser.newContext();
}

export async function getBookInformation(page: Page, book: Book): Promise<ScraperResult> {
	scraperUtil = new ScraperUtil(page);

	const returnDates: DateTime[] = [];
	let bookData = newScraperResult();

	try {
		await page.goto('https://katalog.halle.de/Mediensuche', { waitUntil: 'domcontentloaded', timeout: 20000 });
	} catch {
		await page.goto('https://katalog.halle.de/Mediensuche', { waitUntil: 'domcontentloaded', timeout: 20000 });
	}
	await expect(page.getByRole('heading', { name: 'Suche' })).toBeVisible();

	await scraperUtil.fillSearchForm(book);
	await scraperUtil.searchForBook();

	await page.waitForURL(/searchhash/, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {});

	const mediumLocator = page.locator('[id$="_divMedium"]');
	const noResultsLocator = page.getByText(/Ihre Suche erzielte keine Treffer|Keine Medien gefunden/i);

	await Promise.race([
		mediumLocator.first().waitFor({ state: 'visible', timeout: 15000 }),
		noResultsLocator.waitFor({ state: 'visible', timeout: 15000 }),
	]).catch(() => {});

	const searchResults = await mediumLocator
		.filter({
			has: page.getByRole('heading').filter({ hasText: buildTitleRegex(book.title) }),
		})
		.filter({
			has: page.locator('.itemtype.book'),
		})
		.all();

	if (searchResults.length === 0) {
		throw new Error(`Buch "${book.title}" wurde im Katalog nicht gefunden`);
	}

	for (const result of searchResults) {
		bookData = await extractData(page, result);

		if (bookData.isAvailable) {
			return bookData; // book is available, no need to check potential other results
		}

		if (bookData.returnDate instanceof DateTime) {
			returnDates.push(bookData.returnDate);
		}

		await page.goBack({ waitUntil: 'domcontentloaded' });
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
		bookData.permalink = await getPermalink(page);

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
		isAvailable: status ? new RegExp(/Verfügbar|Heute zurückgegeben/).test(status) : false,
		returnDate: returnDate ? DateTime.fromFormat(returnDate, 'dd.MM.yyyy', { locale: 'de' }) : null,
	};
}

async function getPermalink(page: Page): Promise<string> {
	try {
		const link = page.getByRole('link', { name: 'Permalink Detailanzeige', exact: false });
		await link.click();
		await expect(page.locator('#dnn_ctr513_MainView_popupPermalinkDetail_lblHeader')).toBeVisible();

		const permalink = await page.locator('#dnn_ctr513_MainView_popupPermalinkDetail_TxtPermaLinkDetail').inputValue();
		await page.getByRole('button', { name: 'OK' }).click();

		return permalink;
	} catch (e) {
		return '';
	}
}
