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

// run once in development
if (process.env?.ENVIRONMENT === 'development') {
	scheduleCommand(DateTime.now().plus(500).toJSDate(), checkBooks);
}

// web interface
serve({
	fetch: handleRequests,
	development: true,
});
