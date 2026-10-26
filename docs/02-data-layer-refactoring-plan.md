# 02 — `bibo-tracker` Data-Layer Refactoring Plan

This plan details every code, configuration, deployment, and test change required inside `bibo-tracker` to replace the Notion integration with the `bun:sqlite` persistence layer and REST sync API specified in [01-api-and-data-model.md](./01-api-and-data-model.md).

---

## 1. File Change Inventory

### 1.1 Files & Dependencies to Delete
Remove the Notion SDK and all Notion-specific connectors, filters, mappers, and property types:

- **Dependency:** `@notionhq/client` (via `bun remove @notionhq/client`)
- `src/lib/notion/notion-connector.ts`
- `src/lib/notion/query-filter.ts`
- `src/types/notion/checkbox-property.ts`
- `src/types/notion/page-properties.ts`
- `src/types/notion/rich-text-property.ts`
- `src/types/notion/title-property.ts`
- `src/types/notion/url-property.ts`
- `src/util/mapper-util.ts`
- `src/lib/store/store.ts` *(superseded by persistent SQLite `app_state` in `src/lib/db/book-repository.ts`)*

### 1.2 Files to Create
| Path | Responsibility |
| :--- | :--- |
| `src/types/api/sync-books.ts` | Request/response TypeScript types (`SyncBookInput`, `SyncBooksRequest`, `SyncBooksResponse`) and strict runtime validator (`validateSyncBooksRequest`). |
| `src/lib/db/database.ts` | Singleton `bun:sqlite` connection manager, directory initialization, WAL/busy-timeout pragmas, schema DDL execution, and test reset helpers. |
| `src/lib/db/book-repository.ts` | Data access & transactional sync logic (`getAllBooks`, `getBooksByIds`, `syncBooksSnapshot`, `updateBookScraperStatus`, `getAppState`, `updateLastChecked`). |
| `src/lib/webserver/api-auth.ts` | Constant-time Bearer token verification (`verifyApiAuth`) against `Bun.env.API_KEY`. |
| `tests/book-repository.test.ts` | Bun unit tests (`bun:test`) for SQLite snapshot reconciliation, order preservation, empty-snapshot guard, and scraper updates using `:memory:`. |
| `tests/request-handler.test.ts` | Bun integration tests (`bun:test`) for HTTP endpoint auth (`401`/`503`), validation (`400`), conflict guard (`409`), sync (`200`), and SSR UI rendering. |

### 1.3 Files to Modify
| Path | Summary of Changes |
| :--- | :--- |
| `package.json` | Remove `@notionhq/client`. |
| `.env.example` | Replace `NOTION_API_KEY` / `NOTION_DATABASE_ID` with `API_KEY` and optional `DATABASE_PATH`. |
| `src/types/env.d.ts` | Update `Bun.Env` interface with `API_KEY` and `DATABASE_PATH`. |
| `src/types/models/book.ts` | Replace `notionId` with `id`; add `returnDate: string \| null` and `lastCheckedAt: string \| null`. |
| `src/types/models/state.ts` | Add `lastSynced: Date \| null` alongside `lastChecked: Date \| null`. |
| `src/commands/check-books.ts` | Read/write via `BookRepository`, add in-memory concurrency guard + queued pending IDs, wrap browser lifecycle in `try/finally`, support targeted scraping (`checkBooks({ bookIds })`). |
| `src/lib/scraper/scraper-util.ts` | Trim `${book.title} ${book.author}`.trim() so books with an empty `author` do not append trailing whitespace to the catalog query. |
| `src/lib/webserver/request-handler.tsx` | Switch to pathname routing (`GET /`, `POST /refresh`, `GET /api/health`, `GET /api/books`, `POST /api/books`, `404` fallback). |
| `src/lib/webserver/book-list.tsx` | Change React key from `book.notionId` to `book.id`; optionally display formatted `returnDate` on borrowed books. |
| `docker-compose.yml` | Add `./data:/app/data` bind mount and optional `.env` loading (`required: false`). |
| `.github/workflows/main.yml` | **Critical:** Remove `-v` from `docker compose down -v` in deploy job; pass `API_KEY` during CI test step. |
| `.gitignore` / `.dockerignore` / `biome.json` | Ignore `data/` and SQLite runtime files (`*.sqlite*`) plus Playwright output directories. |
| `tests/application-test.spec.ts` & `tests/scraper-test.spec.ts` | Update `Book` fixtures (`notionId` → `id`, add `returnDate: null`, `lastCheckedAt: null`). |
| `README.md` | Document new Anytype push architecture, environment variables, and `/api/books` usage. |

---

## 2. Detailed Implementation Blueprints

> [!NOTE]
> All TypeScript modules in this repository use `verbatimModuleSyntax: true` and `allowImportingTsExtensions: true` (see `tsconfig.json`), and Biome enforces tabs, single quotes, and 120-character line width (see `biome.json`).

### Step 1: Environment & Domain Types

#### `.env.example`
```dotenv
ENVIRONMENT=""
PORT=1234 # docker host port

API_KEY="" # Bearer token required for POST/GET /api/books (e.g. openssl rand -hex 32)
DATABASE_PATH="./data/bibo.sqlite"

NTFY_URL=""
NTFY_TOPIC=""
NTFY_API_KEY=""
```

#### `src/types/env.d.ts`
```ts
declare module 'bun' {
	interface Env {
		API_KEY?: string;
		DATABASE_PATH?: string;
		ENVIRONMENT?: string;

		NTFY_URL?: string;
		NTFY_TOPIC?: string;
		NTFY_API_KEY?: string;
	}
}
```

---

### Step 2: SQLite Database & Repository Layer

#### `src/lib/db/database.ts`
Manages a lazy singleton `Database` instance and supports re-initializing with `:memory:` in tests:

```ts
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

export function initDatabase(dbPath: string): Database {
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
```

#### `src/lib/db/book-repository.ts`
Encapsulates all SQL queries and row mapping:

```ts
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
	};
}

export namespace BookRepository {
	export function getAllBooks(): Book[] {
		const rows = getDatabase()
			.query<BookRow, []>('SELECT * FROM books ORDER BY sort_order ASC, created_at ASC')
			.all();
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
			const deleteStmt = db.query('DELETE FROM books WHERE id = ?');
			for (const existing of existingRows) {
				if (!incomingIds.has(existing.id)) {
					deleteStmt.run(existing.id);
					removed++;
				}
			}

			let added = 0;
			let updated = 0;
			let unchanged = 0;
			const booksToScrapeIds: string[] = [];

			const insertStmt = db.query(`
				INSERT INTO books (id, title, author, sort_order, is_available, location, permalink, return_date, last_checked_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, 0, '', NULL, NULL, NULL, ?, ?)
			`);

			const updateChangedMetaStmt = db.query(`
				UPDATE books
				SET title = ?, author = ?, sort_order = ?, location = '', permalink = NULL, return_date = NULL, last_checked_at = NULL, updated_at = ?
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
			};
		});

		return runSync();
	}

	export function updateBookScraperStatus(bookId: string, result: ScraperResult): void {
		const now = new Date().toISOString();
		const isAvailableInt = result.isAvailable ? 1 : 0;
		const returnDateIso =
			!result.isAvailable && result.returnDate?.isValid ? result.returnDate.toISODate() : null;
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
				    updated_at = ?
				WHERE id = ?
			`)
			.run(isAvailableInt, returnDateIso, cleanLocation, cleanPermalink, now, now, bookId);
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
```

---

### Step 3: Payload Validation & Bearer Auth

#### `src/types/api/sync-books.ts`
Zero-dependency validator returning structured validation errors:

```ts
export type SyncBookInput = {
	id: string;
	title: string;
	author?: string | null;
};

export type SyncBooksRequest = {
	books: SyncBookInput[];
	allowEmpty?: boolean;
};

export type SyncBooksResponse = {
	syncedAt: string;
	total: number;
	added: number;
	updated: number;
	unchanged: number;
	removed: number;
	scrapeTriggered: boolean;
};

export function validateSyncBooksRequest(
	payload: unknown,
): { ok: true; data: SyncBooksRequest } | { ok: false; details: string[] } {
	const details: string[] = [];

	if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
		return { ok: false, details: ['Request body must be a JSON object'] };
	}

	const record = payload as Record<string, unknown>;
	if (!Array.isArray(record.books)) {
		return { ok: false, details: ['"books" must be an array'] };
	}
	if (record.books.length > 1000) {
		return { ok: false, details: ['"books" must not exceed 1000 items'] };
	}
	if (record.allowEmpty !== undefined && typeof record.allowEmpty !== 'boolean') {
		details.push('"allowEmpty" must be a boolean when provided');
	}

	const seenIds = new Set<string>();
	const normalizedBooks: SyncBookInput[] = [];

	record.books.forEach((item, index) => {
		if (typeof item !== 'object' || item === null || Array.isArray(item)) {
			details.push(`books[${index}] must be an object`);
			return;
		}
		const b = item as Record<string, unknown>;
		const id = typeof b.id === 'string' ? b.id.trim() : '';
		const title = typeof b.title === 'string' ? b.title.trim() : '';

		if (!id || id.length > 256) {
			details.push(`books[${index}].id must be a non-empty string (max 256 chars)`);
		} else if (seenIds.has(id)) {
			details.push(`books[${index}].id "${id}" is duplicated in payload`);
		} else {
			seenIds.add(id);
		}

		if (!title || title.length > 500) {
			details.push(`books[${index}].title must be a non-empty string (max 500 chars)`);
		}

		if (b.author !== undefined && b.author !== null && typeof b.author !== 'string') {
			details.push(`books[${index}].author must be a string, null, or omitted`);
		} else if (typeof b.author === 'string' && b.author.trim().length > 500) {
			details.push(`books[${index}].author must not exceed 500 chars`);
		}

		normalizedBooks.push({
			id,
			title,
			author: typeof b.author === 'string' ? b.author.trim() : '',
		});
	});

	if (details.length > 0) {
		return { ok: false, details };
	}

	return {
		ok: true,
		data: {
			books: normalizedBooks,
			allowEmpty: record.allowEmpty === true,
		},
	};
}
```

#### `src/lib/webserver/api-auth.ts`
```ts
import { createHash, timingSafeEqual } from 'node:crypto';

export type AuthCheckResult = { ok: true } | { ok: false; status: 401 | 503; error: string };

function sha256(value: string): Buffer {
	return createHash('sha256').update(value, 'utf8').digest();
}

export function verifyApiAuth(request: Request): AuthCheckResult {
	const configuredKey = Bun.env.API_KEY?.trim();
	if (!configuredKey) {
		return { ok: false, status: 503, error: 'Sync API is not configured' };
	}

	const header = request.headers.get('Authorization') ?? '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) {
		return { ok: false, status: 401, error: 'Unauthorized' };
	}

	const providedToken = match[1].trim();
	const isValid = timingSafeEqual(sha256(configuredKey), sha256(providedToken));
	if (!isValid) {
		return { ok: false, status: 401, error: 'Unauthorized' };
	}

	return { ok: true };
}
```

---

### Step 4: Scraper & `checkBooks` Command Refactoring

Update [`src/commands/check-books.ts`](../src/commands/check-books.ts) and [`src/lib/scraper/scraper-util.ts`](../src/lib/scraper/scraper-util.ts):

1. **Browser Leak Prevention (`try / finally`):** Ensure `await browser.close()` (not only `context.close()`! Note that in [`src/lib/scraper/scraper.ts`](../src/lib/scraper/scraper.ts), `launchBrowser()` launches `chromium.launch()` and returns `browser.newContext()` — closing only `context` leaves the Chromium browser child process alive! Update `launchBrowser()` or close `context.browser()?.close()` in `finally` to prevent memory leaks over weeks of uptime!).
2. **Concurrency Lock (`isCheckingBooks`):** Prevent overlapping Chromium sessions if a user clicks "Aktualisieren" (`/refresh`) while a scheduled cron run or post-sync scrape is already active:
   - Export `isScraperRunning(): boolean` for `/api/health`.
   - Maintain a `pendingBookIds: Set<string> | 'ALL' | null` queue: if a `POST /api/books` adds new books while a scrape is already in progress, automatically run a follow-up scrape for those newly added IDs right after the active run finishes.
3. **Targeted Scraping (`checkBooks({ bookIds?: string[] })`):**
   - Full check (`checkBooks()`): scrapes `BookRepository.getAllBooks()` and updates `BookRepository.updateLastChecked()`.
   - Targeted check (`checkBooks({ bookIds })`): scrapes only `BookRepository.getBooksByIds(bookIds)` (newly added or title/author-modified books from `POST /api/books`). If all books were checked, also updates `lastChecked`.
4. **Search Query Trimming in `ScraperUtil.fillSearchForm`:**
   ```ts
   await searchInput.fill(`${book.title} ${book.author}`.trim());
   ```

---

### Step 5: HTTP Routing & UI Updates

#### `src/lib/webserver/request-handler.tsx`
Replace substring matching (`request.url.includes('/refresh')`) with clean `URL` pathname routing:

- `GET /` → Read `BookRepository.getAllBooks()` and `BookRepository.getAppState()`, stream `<App />`.
- `POST /refresh` → Trigger `void checkBooks()`, return `200 OK`.
- `GET /api/health` → Return `Response.json({ status: 'ok', bookCount, isChecking: isScraperRunning(), lastChecked, lastSynced })`.
- `GET /api/books` → Run `verifyApiAuth(request)` → return `Response.json({ books, lastChecked, lastSynced })`.
- `POST /api/books` →
  1. Run `verifyApiAuth(request)`.
  2. Enforce max request size (check `Content-Length` / read text length ≤ `1_048_576` bytes).
  3. Parse JSON (`400` on syntax error) & run `validateSyncBooksRequest` (`400` on schema error).
  4. Call `BookRepository.syncBooksSnapshot(data.books, { allowEmpty: data.allowEmpty })` (catch `EmptySnapshotError` → `409 Conflict`).
  5. If `summary.booksToScrapeIds.length > 0`, trigger `void checkBooks({ bookIds: summary.booksToScrapeIds })`.
  6. Return `200 OK` with `SyncBooksResponse`.
- Fallback → `new Response('Not Found', { status: 404 })`.

#### `src/lib/webserver/book-list.tsx`
1. Update the list item key on line 40:
   ```tsx
   <div className="book" key={book.id}>
   ```
2. **Optional UI Enhancement (`returnDate`):** Because library status is no longer synced back to a note app, displaying the earliest return date directly in `bibowatch` when a book is borrowed surfaces already-scraped data:
   ```tsx
   const formattedReturnDate =
   	!book.isAvailable && book.returnDate
   		? DateTime.fromISO(book.returnDate).toFormat('dd.MM.yyyy')
   		: null;
   const meta = [rest, book.author, formattedReturnDate ? `bis ${formattedReturnDate}` : '']
   	.filter(Boolean)
   	.join(' · ');
   ```

---

## 3. Infrastructure, Docker & CI/CD Changes

> [!CAUTION]
> **Critical Data-Loss Fix in `.github/workflows/main.yml`:**
> Line 46 of [`.github/workflows/main.yml`](../.github/workflows/main.yml) currently executes `docker compose down -v` on `/opt/bibo-tracker` on every push to `master`. We must **both** mount `./data:/app/data` as a host bind mount **and** remove the `-v` flag (`docker compose down`) so the production SQLite database at `/opt/bibo-tracker/data/bibo.sqlite` is never wiped during deployments.

### 3.1 `docker-compose.yml`
```yaml
services:
  server:
    restart: always
    build:
      context: .
      dockerfile: src/Dockerfile
    env_file:
      - path: .env
        required: false
    environment:
      - DATABASE_PATH=/app/data/bibo.sqlite
    volumes:
      - ./data:/app/data
    ports:
      - "${PORT:-3000}:3000"
```
*Note:* `required: false` on `env_file` ensures `docker compose up -d` succeeds in GitHub Actions CI where no `.env` file is present on disk, while automatically loading `/opt/bibo-tracker/.env` in production.

### 3.2 `.github/workflows/main.yml`
1. In the `build` job, pass a test `API_KEY` when starting the container so API integration tests can exercise authenticated `/api/books` calls:
   ```yaml
   - name: Run docker compose
     env:
       API_KEY: test-ci-api-key
     run: docker compose up -d
   ```
2. In the `deploy` job, remove `-v` from `docker compose down`:
   ```yaml
   - run: |
       ssh ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }} "
         cd /opt/bibo-tracker
         mkdir -p data
         docker compose down
         git pull
         docker compose up --build -d
       "
   ```
3. **One-time server setup on `/opt/bibo-tracker`:** Add `API_KEY=<generated-secret>` to `/opt/bibo-tracker/.env` and remove `NOTION_API_KEY` / `NOTION_DATABASE_ID`.

### 3.3 Ignore Configuration
- **`.gitignore`:** Append:
  ```gitignore
  /data/
  *.sqlite
  *.sqlite-wal
  *.sqlite-shm
  ```
- **`.dockerignore`:** Update to prevent local `node_modules`, `.git`, `.env`, and local SQLite files from entering the Docker build context:
  ```dockerignore
  node_modules
  .git
  .env
  data
  *.sqlite*
  playwright-report
  test-results
  ```
- **`biome.json`:** Add `"data/*"`, `"playwright-report/*"`, and `"test-results/*"` to `files.ignore`.

---

## 4. Verification & Testing Plan

### Phase 1 — Repository & Validator Unit Tests (`tests/book-repository.spec.ts`)
Using `initDatabase(':memory:')` before each test:
1. **Initial snapshot insert:** Syncing 3 books inserts all 3 with `sortOrder` `0, 1, 2`, `isAvailable: false`, and returns `added: 3`, `booksToScrapeIds.length === 3`.
2. **Preserving scraped state across syncs:** After calling `updateBookScraperStatus(id, { isAvailable: true, location: 'R 11 Thriller', permalink: 'https://...', returnDate: null })`, re-syncing the same book list returns `unchanged: 3` and preserves `isAvailable: true`, `location`, and `permalink`.
3. **Order updates:** Reordering the array in a subsequent snapshot changes the order returned by `getAllBooks()` without resetting scraped availability.
4. **Title/author edit reset:** Changing a book's `title` updates `title`, resets `location` / `permalink` / `returnDate`, preserves `isAvailable`, and marks only that book ID in `booksToScrapeIds`.
5. **Pruning removed books:** Omitting 1 of 3 books deletes that row (`removed: 1`, `total: 2`).
6. **Empty snapshot guard:** Syncing `[]` when DB has 2 books throws `EmptySnapshotError` unless `allowEmpty: true` is passed.

### Phase 2 — HTTP API & E2E Tests (`tests/sync-api.spec.ts` & `tests/application-test.spec.ts`)
Against `http://localhost:3000`:
1. `GET /api/health` returns `200` with `{ status: 'ok' }`.
2. `POST /api/books` without header or with wrong token returns `401 Unauthorized`.
3. `POST /api/books` with malformed payload or duplicate `id` returns `400 Bad Request`.
4. `POST /api/books` with valid Bearer token and 2 books returns `200 OK`, and navigating to `http://localhost:3000` renders both book titles in the UI.
5. `POST /api/books` with `{ books: [] }` (without `allowEmpty`) returns `409 Conflict`; with `{ books: [], allowEmpty: true }` returns `200 OK` and UI renders `"Keine Bücher gefunden."`.

---

## 5. Ordered Implementation Checklist

- [ ] **1. Clean up Notion:** `bun remove @notionhq/client`, delete `src/lib/notion/`, `src/types/notion/`, `src/util/mapper-util.ts`, and `src/lib/store/store.ts`.
- [ ] **2. Update types & env:** Update `src/types/models/book.ts`, `src/types/models/state.ts`, `src/types/env.d.ts`, `.env.example`, and create `src/types/api/sync-books.ts`.
- [ ] **3. Implement SQLite layer:** Create `src/lib/db/database.ts` and `src/lib/db/book-repository.ts`. Initialize DB on startup in `src/index.ts` (and log a warning if `API_KEY` is unset).
- [ ] **4. Refactor scraper & `checkBooks`:** Fix browser closing in `src/lib/scraper/scraper.ts`, trim search input in `src/lib/scraper/scraper-util.ts`, and wire `src/commands/check-books.ts` to `BookRepository` with concurrency locking and targeted `bookIds` support.
- [ ] **5. Build HTTP API & update UI:** Create `src/lib/webserver/api-auth.ts`, update routing in `src/lib/webserver/request-handler.tsx`, and update `src/lib/webserver/book-list.tsx` (`book.id` + optional `returnDate`).
- [ ] **6. Update Docker, ignores & CI/CD:** Update `docker-compose.yml`, `.gitignore`, `.dockerignore`, `biome.json`, `.github/workflows/main.yml`, and `README.md`.
- [ ] **7. Add & run tests:** Add repository + API specs, update existing Playwright tests, verify `bun run lint` and `bun run test`.
