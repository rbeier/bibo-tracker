// import only needed for hot reloading
import './app.css';
import './app.tsx';

import type { Server } from 'bun';
import { renderToReadableStream } from 'react-dom/server';
import { checkBooks, isScraperRunning } from '../../commands/check-books.ts';
import { type SyncBooksResponse, validateSyncBooksRequest } from '../../types/api/sync-books.ts';
import { BookRepository, EmptySnapshotError } from '../db/book-repository.ts';
import { sendBookListUpdatedNotification } from '../notification/notification.ts';
import { verifyApiAuth } from './api-auth.ts';
import App from './app.tsx';

const MAX_BODY_BYTES = 1_048_576; // 1 MB
const scripts = await Bun.file('src/lib/webserver/scripts.js').text();

export async function handleRequests(request: Request, _server?: Server): Promise<Response> {
	const url = new URL(request.url);
	const { pathname } = url;
	const method = request.method.toUpperCase();

	if (pathname === '/refresh') {
		if (method !== 'POST') {
			return Response.json({ error: 'Method not allowed' }, { status: 405 });
		}
		// noinspection ES6MissingAwait we do not want to wait here
		void checkBooks();
		return new Response('', { status: 200 });
	}

	if (pathname === '/api/health') {
		if (method !== 'GET') {
			return Response.json({ error: 'Method not allowed' }, { status: 405 });
		}
		const state = BookRepository.getAppState();
		return Response.json({
			status: 'ok',
			bookCount: BookRepository.countBooks(),
			isChecking: isScraperRunning(),
			lastChecked: state.lastChecked?.toISOString() ?? null,
			lastSynced: state.lastSynced?.toISOString() ?? null,
		});
	}

	if (pathname === '/api/books') {
		if (method !== 'GET' && method !== 'POST') {
			return Response.json({ error: 'Method not allowed' }, { status: 405 });
		}

		const auth = verifyApiAuth(request);
		if (!auth.ok) {
			return Response.json({ error: auth.error }, { status: auth.status });
		}

		if (method === 'GET') {
			const books = BookRepository.getAllBooks();
			const state = BookRepository.getAppState();
			return Response.json({
				books,
				lastChecked: state.lastChecked?.toISOString() ?? null,
				lastSynced: state.lastSynced?.toISOString() ?? null,
			});
		}

		return handleSyncBooksPost(request, url);
	}

	if (pathname === '/') {
		if (method !== 'GET') {
			return Response.json({ error: 'Method not allowed' }, { status: 405 });
		}
		const books = BookRepository.getAllBooks();
		const state = BookRepository.getAppState();
		const stream = await renderToReadableStream(
			<App books={books} lastChecked={state.lastChecked} lastSynced={state.lastSynced} />,
			{
				bootstrapScriptContent: scripts,
			},
		);

		return new Response(stream, {
			headers: { 'Content-Type': 'text/html' },
		});
	}

	return new Response('Not Found', { status: 404 });
}

async function handleSyncBooksPost(request: Request, url: URL): Promise<Response> {
	const contentLength = Number(request.headers.get('content-length') ?? '0');
	if (contentLength > MAX_BODY_BYTES) {
		return Response.json({ error: 'Payload too large' }, { status: 413 });
	}

	const rawText = await request.text();
	if (Buffer.byteLength(rawText, 'utf8') > MAX_BODY_BYTES) {
		return Response.json({ error: 'Payload too large' }, { status: 413 });
	}

	let parsedBody: unknown;
	try {
		parsedBody = JSON.parse(rawText);
	} catch {
		return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const validation = validateSyncBooksRequest(parsedBody);
	if (!validation.ok) {
		return Response.json({ error: 'Validation failed', details: validation.details }, { status: 400 });
	}

	try {
		const summary = BookRepository.syncBooksSnapshot(validation.data.books, {
			allowEmpty: validation.data.allowEmpty,
		});

		if (summary.added > 0 || summary.removed > 0) {
			void sendBookListUpdatedNotification(summary);
		}

		const skipScrape = url.searchParams.get('skipScrape') === 'true';
		const scrapeTriggered = summary.booksToScrapeIds.length > 0 && !skipScrape;
		if (scrapeTriggered) {
			void checkBooks({ bookIds: summary.booksToScrapeIds });
		}

		const responseBody: SyncBooksResponse = {
			syncedAt: summary.syncedAt,
			total: summary.total,
			added: summary.added,
			updated: summary.updated,
			unchanged: summary.unchanged,
			removed: summary.removed,
			scrapeTriggered,
		};

		return Response.json(responseBody, { status: 200 });
	} catch (error) {
		if (error instanceof EmptySnapshotError) {
			return Response.json({ error: error.message }, { status: 409 });
		}
		console.error('Failed to sync books snapshot:', error);
		return Response.json({ error: 'Internal server error' }, { status: 500 });
	}
}
