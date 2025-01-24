import { checkBooks } from './commands/check-books.ts';
import { reloadBookList } from './commands/reload-book-list.ts';
import { Store } from './lib/store/store.ts';
import { parseCliArgs } from './util/cli-args.ts';
import { scheduleCommand } from './util/cron-util.ts';

const args = parseCliArgs();

if (args.init) {
	await Store.init();
}

if (args.reloadBooks) {
	Store.checkExistence();
	await reloadBookList();
}

if (args.checkBooks) {
	Store.checkExistence();
	await checkBooks();
}

if (Object.keys(args).length === 0) {
	console.log('Starting cron mode');

	scheduleCommand('0 09 * * 1-6', reloadBookList);
	scheduleCommand('0 10 * * 1-6', checkBooks);

	scheduleCommand('0 15 * * 1-6', reloadBookList);
	scheduleCommand('0 16 * * 1-6', checkBooks);
}
