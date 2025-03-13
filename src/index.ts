import { serve } from 'bun';
import { DateTime } from 'luxon';
import { checkBooks } from './commands/check-books.ts';
import { handleRequests } from './lib/webserver/request-handler.tsx';
import { parseCliArgs } from './util/cli-args.ts';
import { scheduleCommand } from './util/cron-util.ts';

const args = parseCliArgs();

// usage without scheduler
if (args.checkBooks) {
	await checkBooks();
	process.exit(0);
}

// scheduler
scheduleCommand('0 10 * * 1-6', checkBooks);
scheduleCommand('0 16 * * 1-6', checkBooks);

// web interface
serve({ fetch: handleRequests, port: 3000 });
