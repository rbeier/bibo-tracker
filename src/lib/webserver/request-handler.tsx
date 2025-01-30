import type { Server } from 'bun';
import { renderToReadableStream } from 'react-dom/server';
import { checkBooks, fetchBooks } from '../../commands/check-books.ts';
import { Store } from '../store/store.ts';
import App from './app.tsx';

const scripts = await Bun.file('src/lib/webserver/scripts.js').text();

export async function handleRequests(request: Request, server: Server): Promise<Response> {
	if (request.url.includes('/refresh') && request.method === 'POST') {
		// noinspection ES6MissingAwait we do not want to wait here
		checkBooks();
		return new Response('', { status: 200 });
	}

	const books = await fetchBooks();
	const stream = await renderToReadableStream(<App books={books} lastChecked={Store.state.lastChecked} />, {
		bootstrapScriptContent: scripts,
	});

	return new Response(stream, {
		headers: { 'Content-Type': 'text/html' },
	});
}
