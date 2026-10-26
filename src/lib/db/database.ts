import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DEFAULT_DB_PATH = './data/bibo.sqlite';

let dbInstance: Database | null = null;

export function getDatabase(): Database {
	if (!dbInstance) {
		const dbPath = Bun.env.DATABASE_PATH || DEFAULT_DB_PATH;
		dbInstance = initDatabase(dbPath);
	}
	return dbInstance;
}

export function initDatabase(dbPath: string = Bun.env.DATABASE_PATH || DEFAULT_DB_PATH): Database {
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}

	if (dbPath !== ':memory:') {
		mkdirSync(dirname(dbPath), { recursive: true });
	}

	const db = new Database(dbPath, { create: true, strict: true });
	db.exec('PRAGMA journal_mode = WAL;');
	db.exec('PRAGMA busy_timeout = 5000;');
	db.exec('PRAGMA foreign_keys = ON;');

	db.exec(`
		CREATE TABLE IF NOT EXISTS books (
			id              TEXT PRIMARY KEY,
			title           TEXT NOT NULL,
			author          TEXT NOT NULL DEFAULT '',
			sort_order      INTEGER NOT NULL DEFAULT 0,
			is_available    INTEGER NOT NULL DEFAULT 0 CHECK (is_available IN (0, 1)),
			location        TEXT NOT NULL DEFAULT '',
			permalink       TEXT,
			return_date     TEXT,
			last_checked_at TEXT,
			created_at      TEXT NOT NULL,
			updated_at      TEXT NOT NULL
		);

		CREATE INDEX IF NOT EXISTS idx_books_sort_order ON books(sort_order ASC);

		CREATE TABLE IF NOT EXISTS app_state (
			key   TEXT PRIMARY KEY,
			value TEXT NOT NULL
		);
	`);

	dbInstance = db;
	return db;
}

export function closeDatabase(): void {
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}
}
