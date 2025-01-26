import { checkBooks } from './commands/check-books.ts';
import { parseCliArgs } from './util/cli-args.ts';
import { scheduleCommand } from './util/cron-util.ts';

const args = parseCliArgs();

// usage without scheduler
if (args.checkBooks) {
	await checkBooks();
	process.exit(0);
}

console.log('Starting cron mode');
scheduleCommand('0 10 * * 1-6', checkBooks);
scheduleCommand('0 16 * * 1-6', checkBooks);
