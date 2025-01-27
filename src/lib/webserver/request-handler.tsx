import type { Server } from 'bun';
import { renderToReadableStream } from 'react-dom/server';
import { fetchBooks } from '../../commands/check-books.ts';
import App from './app.tsx';

export async function handleRequests(request: Request, server: Server): Promise<Response> {
	const books = await fetchBooks();
	const stream = await renderToReadableStream(<App books={books} />);

	return new Response(stream, {
		headers: { 'Content-Type': 'text/html' },
	});
}
