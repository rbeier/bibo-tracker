import type { SyncBookInput } from '../../types/api/sync-books.ts';
import type { Book } from '../../types/models/book.ts';
import type { ScraperResult } from '../../types/models/scraper-result.ts';
import type { State } from '../../types/models/state.ts';
import { getDatabase } from './database.ts';

type BookRow = {
	id: string;
	title: string;
	author: string;
	sort_order: number;
	is_available: number;
	location: string;
	permalink: string | null;
	return_date: string | null;
	last_checked_at: string | null;
	scrape_error: string | null;
};

export class EmptySnapshotError extends Error {
	constructor(public readonly existingCount: number) {
		super(`Refusing to clear ${existingCount} existing book(s) without allowEmpty=true`);
		this.name = 'EmptySnapshotError';
	}
}

export type SnapshotSyncSummary = {
	syncedAt: string;
	total: number;
	added: number;
	updated: number;
	unchanged: number;
	removed: number;
	booksToScrapeIds: string[];
	addedBooks?: Array<{ id: string; title: string; author: string }>;
	removedBooks?: Array<{ id: string; title: string; author: string }>;
};

function rowToBook(row: BookRow): Book {
	return {
		id: row.id,
		title: row.title,
		author: row.author,
		isAvailable: row.is_available === 1,
		location: row.location,
		permalink: row.permalink,
		returnDate: row.return_date,
		lastCheckedAt: row.last_checked_at,
		scrapeError: row.scrape_error,
	};
}

export namespace BookRepository {
	export function getAllBooks(): Book[] {
		const rows = getDatabase().query<BookRow, []>('SELECT * FROM books ORDER BY sort_order ASC, created_at ASC').all();
		return rows.map(rowToBook);
	}

	export function getBooksByIds(ids: string[]): Book[] {
		if (ids.length === 0) return [];
		const placeholders = ids.map(() => '?').join(', ');
		const rows = getDatabase()
			.query<BookRow, string[]>(`SELECT * FROM books WHERE id IN (${placeholders}) ORDER BY sort_order ASC`)
			.all(...ids);
		return rows.map(rowToBook);
	}

	export function countBooks(): number {
		const row = getDatabase().query<{ count: number }, []>('SELECT COUNT(*) as count FROM books').get();
		return row?.count ?? 0;
	}

	export function syncBooksSnapshot(
		inputs: SyncBookInput[],
		options: { allowEmpty?: boolean } = {},
	): SnapshotSyncSummary {
		const db = getDatabase();
		const now = new Date().toISOString();

		const runSync = db.transaction((): SnapshotSyncSummary => {
			const existingRows = db.query<BookRow, []>('SELECT * FROM books').all();
			if (inputs.length === 0 && existingRows.length > 0 && !options.allowEmpty) {
				throw new EmptySnapshotError(existingRows.length);
			}

			const existingById = new Map(existingRows.map((row) => [row.id, row]));
			const incomingIds = new Set(inputs.map((b) => b.id));

			let removed = 0;
			const removedBooks: Array<{ id: string; title: string; author: string }> = [];
			const deleteStmt = db.query('DELETE FROM books WHERE id = ?');
			for (const existing of existingRows) {
				if (!incomingIds.has(existing.id)) {
					deleteStmt.run(existing.id);
					removed++;
					removedBooks.push({ id: existing.id, title: existing.title, author: existing.author });
				}
			}

			let added = 0;
			let updated = 0;
			let unchanged = 0;
			const booksToScrapeIds: string[] = [];
			const addedBooks: Array<{ id: string; title: string; author: string }> = [];

			const insertStmt = db.query(`
				INSERT INTO books (id, title, author, sort_order, is_available, location, permalink, return_date, last_checked_at, scrape_error, created_at, updated_at)
				VALUES (?, ?, ?, ?, 0, '', NULL, NULL, NULL, NULL, ?, ?)
			`);

			const updateChangedMetaStmt = db.query(`
				UPDATE books
				SET title = ?, author = ?, sort_order = ?, location = '', permalink = NULL, return_date = NULL, last_checked_at = NULL, scrape_error = NULL, updated_at = ?
				WHERE id = ?
			`);

			const updateSortOrderStmt = db.query(`
				UPDATE books SET sort_order = ?, updated_at = ? WHERE id = ?
			`);

			inputs.forEach((input, index) => {
				const title = input.title.trim();
				const author = (input.author ?? '').trim();
				const existing = existingById.get(input.id);

				if (!existing) {
					insertStmt.run(input.id, title, author, index, now, now);
					added++;
					booksToScrapeIds.push(input.id);
					addedBooks.push({ id: input.id, title, author });
				} else if (existing.title !== title || existing.author !== author) {
					updateChangedMetaStmt.run(title, author, index, now, input.id);
					updated++;
					booksToScrapeIds.push(input.id);
				} else {
					if (existing.sort_order !== index) {
						updateSortOrderStmt.run(index, now, input.id);
					}
					unchanged++;
				}
			});

			setStateValue('last_synced_at', now);

			return {
				syncedAt: now,
				total: inputs.length,
				added,
				updated,
				unchanged,
				removed,
				booksToScrapeIds,
				addedBooks,
				removedBooks,
			};
		});

		return runSync();
	}

	export function updateBookScraperStatus(bookId: string, result: ScraperResult): void {
		const now = new Date().toISOString();
		const isAvailableInt = result.isAvailable ? 1 : 0;
		const returnDateIso = !result.isAvailable && result.returnDate?.isValid ? result.returnDate.toISODate() : null;
		const cleanLocation = result.location?.trim() || null;
		const cleanPermalink = result.permalink?.trim() || null;

		getDatabase()
			.query(`
				UPDATE books
				SET is_available = ?,
				    return_date = ?,
				    location = COALESCE(?, location),
				    permalink = COALESCE(?, permalink),
				    last_checked_at = ?,
				    scrape_error = NULL,
				    updated_at = ?
				WHERE id = ?
			`)
			.run(isAvailableInt, returnDateIso, cleanLocation, cleanPermalink, now, now, bookId);
	}

	export function updateBookScraperError(bookId: string, error: unknown): void {
		const now = new Date().toISOString();
		const reason = error instanceof Error ? error.message : String(error);

		getDatabase()
			.query(`
				UPDATE books
				SET scrape_error = ?,
				    updated_at = ?
				WHERE id = ?
			`)
			.run(reason || 'Unbekannter Fehler', now, bookId);
	}

	export function updateLastChecked(date: Date = new Date()): void {
		setStateValue('last_checked_at', date.toISOString());
	}

	export function getAppState(): State {
		const lastCheckedRaw = getStateValue('last_checked_at');
		const lastSyncedRaw = getStateValue('last_synced_at');
		return {
			lastChecked: lastCheckedRaw ? new Date(lastCheckedRaw) : null,
			lastSynced: lastSyncedRaw ? new Date(lastSyncedRaw) : null,
		};
	}

	function setStateValue(key: string, value: string): void {
		getDatabase()
			.query('INSERT INTO app_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
			.run(key, value);
	}

	function getStateValue(key: string): string | null {
		const row = getDatabase().query<{ value: string }, [string]>('SELECT value FROM app_state WHERE key = ?').get(key);
		return row?.value ?? null;
	}
}
