import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { DateTime } from 'luxon';
import { BookRepository, EmptySnapshotError } from '../src/lib/db/book-repository.ts';
import { closeDatabase, initDatabase } from '../src/lib/db/database.ts';
import { validateSyncBooksRequest } from '../src/types/api/sync-books.ts';

describe('BookRepository & Sync Payload Validation', () => {
	beforeEach(() => {
		initDatabase(':memory:');
	});

	afterEach(() => {
		closeDatabase();
	});

	test('should insert new books on initial snapshot sync and preserve order', () => {
		const summary = BookRepository.syncBooksSnapshot([
			{ id: 'book-1', title: 'Holly', author: 'Stephen King' },
			{ id: 'book-2', title: 'Der Schwarm', author: 'Frank Schätzing' },
			{ id: 'book-3', title: 'Ohne Autor' },
		]);

		expect(summary.total).toBe(3);
		expect(summary.added).toBe(3);
		expect(summary.updated).toBe(0);
		expect(summary.unchanged).toBe(0);
		expect(summary.removed).toBe(0);
		expect(summary.booksToScrapeIds).toEqual(['book-1', 'book-2', 'book-3']);
		expect(summary.addedBooks).toEqual([
			{ id: 'book-1', title: 'Holly', author: 'Stephen King' },
			{ id: 'book-2', title: 'Der Schwarm', author: 'Frank Schätzing' },
			{ id: 'book-3', title: 'Ohne Autor', author: '' },
		]);

		const books = BookRepository.getAllBooks();
		expect(books).toHaveLength(3);
		expect(books.map((b) => b.id)).toEqual(['book-1', 'book-2', 'book-3']);
		expect(books[0]).toMatchObject({
			id: 'book-1',
			title: 'Holly',
			author: 'Stephen King',
			isAvailable: false,
			location: '',
			permalink: null,
			returnDate: null,
			lastCheckedAt: null,
		});
		expect(books[2].author).toBe('');
		expect(BookRepository.getAppState().lastSynced).toBeInstanceOf(Date);
	});

	test('should preserve scraped status across subsequent syncs and update incoming sort order', () => {
		BookRepository.syncBooksSnapshot([
			{ id: 'book-1', title: 'Holly', author: 'Stephen King' },
			{ id: 'book-2', title: 'Der Schwarm', author: 'Frank Schätzing' },
		]);

		BookRepository.updateBookScraperStatus('book-1', {
			isAvailable: true,
			location: 'R 11 Thriller',
			permalink: 'https://katalog.halle.de/book-1',
			returnDate: DateTime.fromISO('2026-11-15'),
		});

		BookRepository.updateBookScraperStatus('book-2', {
			isAvailable: false,
			location: 'R 11 SciFi',
			permalink: 'https://katalog.halle.de/book-2',
			returnDate: DateTime.fromISO('2026-11-20'),
		});

		// Re-sync in reversed order without modifying title/author
		const summary = BookRepository.syncBooksSnapshot([
			{ id: 'book-2', title: 'Der Schwarm', author: 'Frank Schätzing' },
			{ id: 'book-1', title: 'Holly', author: 'Stephen King' },
		]);

		expect(summary.added).toBe(0);
		expect(summary.updated).toBe(0);
		expect(summary.unchanged).toBe(2);
		expect(summary.removed).toBe(0);
		expect(summary.booksToScrapeIds).toEqual([]);

		const books = BookRepository.getAllBooks();
		expect(books.map((b) => b.id)).toEqual(['book-2', 'book-1']);

		// book-2 is borrowed -> returnDate is stored
		expect(books[0]).toMatchObject({
			id: 'book-2',
			isAvailable: false,
			location: 'R 11 SciFi',
			permalink: 'https://katalog.halle.de/book-2',
			returnDate: '2026-11-20',
		});

		// book-1 is available -> returnDate is cleared to null
		expect(books[1]).toMatchObject({
			id: 'book-1',
			isAvailable: true,
			location: 'R 11 Thriller',
			permalink: 'https://katalog.halle.de/book-1',
			returnDate: null,
		});
		expect(typeof books[1].lastCheckedAt).toBe('string');
	});

	test('should reset catalog metadata and queue re-scrape when title or author changes, and prune removed books', () => {
		BookRepository.syncBooksSnapshot([
			{ id: 'book-1', title: 'Holli', author: 'Stephen King' },
			{ id: 'book-2', title: 'To Remove', author: 'Someone' },
		]);

		BookRepository.updateBookScraperStatus('book-1', {
			isAvailable: true,
			location: 'Old Location',
			permalink: 'https://katalog.halle.de/old',
			returnDate: null,
		});

		const summary = BookRepository.syncBooksSnapshot([{ id: 'book-1', title: 'Holly', author: 'Stephen King' }]);

		expect(summary).toMatchObject({
			total: 1,
			added: 0,
			updated: 1,
			unchanged: 0,
			removed: 1,
			booksToScrapeIds: ['book-1'],
			removedBooks: [{ id: 'book-2', title: 'To Remove', author: 'Someone' }],
		});

		const [book1] = BookRepository.getAllBooks();
		expect(book1).toMatchObject({
			id: 'book-1',
			title: 'Holly',
			author: 'Stephen King',
			isAvailable: true, // Preserved to avoid duplicate notifications on minor edits
			location: '',
			permalink: null,
			returnDate: null,
			lastCheckedAt: null,
		});
	});

	test('should guard against accidental empty snapshots unless allowEmpty is true', () => {
		BookRepository.syncBooksSnapshot([{ id: 'book-1', title: 'Holly', author: 'Stephen King' }]);

		expect(() => BookRepository.syncBooksSnapshot([])).toThrow(EmptySnapshotError);
		expect(BookRepository.countBooks()).toBe(1);

		const cleared = BookRepository.syncBooksSnapshot([], { allowEmpty: true });
		expect(cleared.total).toBe(0);
		expect(cleared.removed).toBe(1);
		expect(BookRepository.countBooks()).toBe(0);
	});

	test('should filter books by IDs and persist lastChecked timestamp', () => {
		BookRepository.syncBooksSnapshot([
			{ id: 'book-1', title: 'One', author: 'A' },
			{ id: 'book-2', title: 'Two', author: 'B' },
			{ id: 'book-3', title: 'Three', author: 'C' },
		]);

		const subset = BookRepository.getBooksByIds(['book-3', 'book-1']);
		expect(subset.map((b) => b.id)).toEqual(['book-1', 'book-3']);
		expect(BookRepository.getBooksByIds([])).toEqual([]);

		const checkDate = new Date('2026-10-26T12:00:00.000Z');
		BookRepository.updateLastChecked(checkDate);
		expect(BookRepository.getAppState().lastChecked?.toISOString()).toBe('2026-10-26T12:00:00.000Z');
	});

	test('should record scrape errors and clear them on successful scrape or title/author change', () => {
		BookRepository.syncBooksSnapshot([
			{ id: 'book-1', title: 'Unknown Book', author: 'Someone' },
			{ id: 'book-2', title: 'Typo Title', author: 'Someone' },
		]);

		BookRepository.updateBookScraperError('book-1', new Error('No matching book found'));
		BookRepository.updateBookScraperError('book-2', 'Timeout');

		let books = BookRepository.getAllBooks();
		expect(books[0].scrapeError).toBe('No matching book found');
		expect(books[1].scrapeError).toBe('Timeout');

		// Successful scrape clears scrapeError on book-1
		BookRepository.updateBookScraperStatus('book-1', {
			isAvailable: true,
			location: 'R 11 Thriller',
			permalink: 'https://katalog.halle.de/book-1',
			returnDate: null,
		});

		// Updating title clears scrapeError on book-2
		BookRepository.syncBooksSnapshot([
			{ id: 'book-1', title: 'Unknown Book', author: 'Someone' },
			{ id: 'book-2', title: 'Fixed Title', author: 'Someone' },
		]);

		books = BookRepository.getAllBooks();
		expect(books[0].scrapeError).toBeNull();
		expect(books[1].scrapeError).toBeNull();
	});

	test('should validate SyncBooksRequest payloads strictly', () => {
		expect(validateSyncBooksRequest(null).ok).toBe(false);
		expect(validateSyncBooksRequest({}).ok).toBe(false);

		const dupResult = validateSyncBooksRequest({
			books: [
				{ id: 'dup', title: 'One' },
				{ id: 'dup', title: 'Two' },
			],
		});
		expect(dupResult.ok).toBe(false);
		if (!dupResult.ok) {
			expect(dupResult.details[0]).toContain('duplicated');
		}

		const validResult = validateSyncBooksRequest({
			books: [{ id: '  abc  ', title: '  Clean Title  ', author: '  Author  ' }],
		});
		expect(validResult).toEqual({
			ok: true,
			data: {
				books: [{ id: 'abc', title: 'Clean Title', author: 'Author' }],
				allowEmpty: false,
			},
		});
	});
});
