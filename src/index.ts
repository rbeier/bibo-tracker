import { reloadBookList } from './commands/reload-book-list.ts';
import { Store } from './lib/store/store.ts';
import { parseCliArgs } from './util/cli-args.ts';

const args = parseCliArgs();

if (args.init) {
	await Store.init();
}

if (args.reloadBooks) {
	Store.checkExistence();
	await reloadBookList();
}
