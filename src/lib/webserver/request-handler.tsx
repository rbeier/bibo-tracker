import type { Server } from 'bun';
import { renderToReadableStream } from 'react-dom/server';
import StatusPageComponent from './status-page';

export async function handleRequests(request: Request, server: Server): Promise<Response> {
	const stream = await renderToReadableStream(<StatusPageComponent />);

	return new Response(stream, {
		headers: { 'Content-Type': 'text/html' },
	});
}
