import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { DateTime } from 'luxon';
import { BookRepository } from '../src/lib/db/book-repository.ts';
import { closeDatabase, initDatabase } from '../src/lib/db/database.ts';
import { handleRequests } from '../src/lib/webserver/request-handler.tsx';

const TEST_API_KEY = 'super-secret-test-key';

describe('HTTP Request Handler & Sync API', () => {
	const originalApiKey = Bun.env.API_KEY;

	beforeEach(() => {
		initDatabase(':memory:');
		Bun.env.API_KEY = TEST_API_KEY;
	});

	afterEach(() => {
		closeDatabase();
		Bun.env.API_KEY = originalApiKey ?? '';
	});

	test('GET /api/health returns public health status', async () => {
		const res = await handleRequests(new Request('http://localhost:3000/api/health'));
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toEqual({
			status: 'ok',
			bookCount: 0,
			isChecking: false,
			lastChecked: null,
			lastSynced: null,
		});
	});

	test('returns 503 when API_KEY is not configured', async () => {
		Bun.env.API_KEY = '';
		const res = await handleRequests(
			new Request('http://localhost:3000/api/books', {
				headers: { Authorization: `Bearer ${TEST_API_KEY}` },
			}),
		);
		expect(res.status).toBe(503);
	});

	test('returns 401 when Authorization header is missing or invalid', async () => {
		const noAuth = await handleRequests(new Request('http://localhost:3000/api/books'));
		expect(noAuth.status).toBe(401);

		const wrongAuth = await handleRequests(
			new Request('http://localhost:3000/api/books', {
				headers: { Authorization: 'Bearer wrong-token' },
			}),
		);
		expect(wrongAuth.status).toBe(401);
	});

	test('POST /api/books validates input and syncs snapshot into SQLite and UI', async () => {
		const invalidRes = await handleRequests(
			new Request('http://localhost:3000/api/books?skipScrape=true', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${TEST_API_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ books: [{ id: '', title: '' }] }),
			}),
		);
		expect(invalidRes.status).toBe(400);

		const syncRes = await handleRequests(
			new Request('http://localhost:3000/api/books?skipScrape=true', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${TEST_API_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					books: [
						{ id: 'any-1', title: 'Holly', author: 'Stephen King' },
						{ id: 'any-2', title: 'Der Schwarm', author: 'Frank Schätzing' },
					],
				}),
			}),
		);
		expect(syncRes.status).toBe(200);
		const syncBody = await syncRes.json();
		expect(syncBody).toMatchObject({
			total: 2,
			added: 2,
			updated: 0,
			unchanged: 0,
			removed: 0,
			scrapeTriggered: false,
		});

		// Simulate scraper finding return date for any-2 and error for any-1
		BookRepository.updateBookScraperError('any-1', new Error('Book not found'));
		BookRepository.updateBookScraperStatus('any-2', {
			isAvailable: false,
			location: 'R 11 SciFi',
			permalink: 'https://katalog.halle.de/schwarm',
			returnDate: DateTime.fromISO('2026-12-01'),
		});

		// GET /api/books returns updated data
		const getRes = await handleRequests(
			new Request('http://localhost:3000/api/books', {
				headers: { Authorization: `Bearer ${TEST_API_KEY}` },
			}),
		);
		expect(getRes.status).toBe(200);
		const getBody = (await getRes.json()) as {
			books: Array<{ id: string; returnDate: string | null; scrapeError: string | null }>;
		};
		expect(getBody.books).toHaveLength(2);
		expect(getBody.books[0].scrapeError).toBe('Book not found');
		expect(getBody.books[1].returnDate).toBe('2026-12-01');
		expect(getBody.books[1].scrapeError).toBeNull();

		// GET / renders SSR HTML containing synced books, warning icon, formatted return date, and lastSynced timestamp
		const uiRes = await handleRequests(new Request('http://localhost:3000/'));
		expect(uiRes.status).toBe(200);
		const html = await uiRes.text();
		expect(html).toContain('Holly');
		expect(html).toContain('Der Schwarm');
		expect(html).toContain('bis 01.12.2026');
		expect(html).toContain('book-warning');
		expect(html).toContain('Zuletzt synchronisiert');

		// Empty snapshot without allowEmpty returns 409 Conflict
		const emptyConflictRes = await handleRequests(
			new Request('http://localhost:3000/api/books?skipScrape=true', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${TEST_API_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ books: [] }),
			}),
		);
		expect(emptyConflictRes.status).toBe(409);

		// Empty snapshot with allowEmpty=true succeeds
		const emptyAllowedRes = await handleRequests(
			new Request('http://localhost:3000/api/books?skipScrape=true', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${TEST_API_KEY}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ books: [], allowEmpty: true }),
			}),
		);
		expect(emptyAllowedRes.status).toBe(200);
		expect(BookRepository.countBooks()).toBe(0);
	});

	test('POST /api/books sends NTFY notification when books are added or removed, but omits when unchanged', async () => {
		const originalFetch = globalThis.fetch;
		const ntfyCalls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];

		Bun.env.NTFY_URL = 'https://ntfy.sh';
		Bun.env.NTFY_TOPIC = 'test-topic';
		Bun.env.NTFY_API_KEY = 'test-ntfy-key';

		globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
			const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
			ntfyCalls.push({
				url: urlStr,
				headers: (init?.headers as Record<string, string>) || {},
				body: typeof init?.body === 'string' ? init.body : '',
			});
			return new Response('ok', { status: 200 });
		}) as unknown as typeof fetch;

		try {
			// 1. Initial sync adding 2 books -> should notify
			await handleRequests(
				new Request('http://localhost:3000/api/books?skipScrape=true', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${TEST_API_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						books: [
							{ id: 'b-1', title: 'Buch Eins', author: 'Autor A' },
							{ id: 'b-2', title: 'Buch Zwei' },
						],
					}),
				}),
			);

			expect(ntfyCalls).toHaveLength(1);
			expect(ntfyCalls[0].url).toBe('https://ntfy.sh/test-topic');
			expect(ntfyCalls[0].headers.Title).toBe('=?UTF-8?B?8J+TmiBCw7xjaGVybGlzdGUgYWt0dWFsaXNpZXJ0?=');
			expect(ntfyCalls[0].body).toContain('+ Buch Eins (Autor A)');
			expect(ntfyCalls[0].body).toContain('+ Buch Zwei');

			// 2. Re-sync identical books (unchanged) -> should NOT notify
			ntfyCalls.length = 0;
			await handleRequests(
				new Request('http://localhost:3000/api/books?skipScrape=true', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${TEST_API_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						books: [
							{ id: 'b-1', title: 'Buch Eins', author: 'Autor A' },
							{ id: 'b-2', title: 'Buch Zwei' },
						],
					}),
				}),
			);

			expect(ntfyCalls).toHaveLength(0);

			// 3. Remove a book -> should notify
			await handleRequests(
				new Request('http://localhost:3000/api/books?skipScrape=true', {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${TEST_API_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						books: [{ id: 'b-1', title: 'Buch Eins', author: 'Autor A' }],
					}),
				}),
			);

			expect(ntfyCalls).toHaveLength(1);
			expect(ntfyCalls[0].body).toContain('- Buch Zwei');
		} finally {
			globalThis.fetch = originalFetch;
			Bun.env.NTFY_URL = undefined;
			Bun.env.NTFY_TOPIC = undefined;
			Bun.env.NTFY_API_KEY = undefined;
		}
	});

	test('returns 404 for unknown routes and 405 for unsupported methods', async () => {
		const notFound = await handleRequests(new Request('http://localhost:3000/unknown'));
		expect(notFound.status).toBe(404);

		const methodNotAllowed = await handleRequests(new Request('http://localhost:3000/api/books', { method: 'DELETE' }));
		expect(methodNotAllowed.status).toBe(405);
	});
});
