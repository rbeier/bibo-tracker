import { DateTime } from 'luxon';
import type { Locator, Page } from 'playwright';
import type { Book } from '../../types/models/book.ts';
import type { ScraperResult } from '../../types/models/scraper-result.ts';

export class ScraperUtil {
	constructor(private readonly page: Page) {}

	async fillSearchForm(book: Book) {
		const searchInput = this.page.getByRole('textbox', { name: 'Suchbegriff' });
		await searchInput.fill(`${book.title} ${book.author}`);

		await this.page.getByRole('combobox').first().selectOption({ index: 1 }); // Zweigstelle
		await this.page.getByText('Physische Medien').click(); // Medienart
	}

	async searchForBook() {
		await Promise.all([
			this.page.getByRole('button', { name: 'Suchen' }).click(),
			this.page.waitForLoadState('networkidle'),
		]);
	}

	async getTableRows(): Promise<Locator[]> {
		const table = this.page.locator('div', { hasText: 'Exemplare' }).locator('table');
		const rows = table.locator('tbody').locator('tr', { hasText: 'Zentralbibo' });

		return rows.all();
	}

	async getBookLocation(): Promise<string> {
		return this.page.getByText('Systematik: Suche nach dieser').locator('a').first().innerText();
	}
}

export function newScraperResult(): ScraperResult {
	return {
		isAvailable: false,
		location: null,
		returnDate: null,
	};
}

export function developmentScraperResult(): ScraperResult {
	return {
		isAvailable: Math.random() > 0.5,
		location: 'R 11',
		returnDate: DateTime.now(),
	};
}
