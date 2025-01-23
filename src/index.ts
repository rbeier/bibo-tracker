import { parseArgs } from 'node:util';
import { Store } from './lib/store.ts';

const { values } = parseArgs({
	args: Bun.argv,
	options: {
		init: {
			type: 'boolean',
		},
	},
	strict: true,
	allowPositionals: true,
});

if (values.init) {
	await Store.init();
} else {
	Store.checkExistence();
	console.log(Store.getItem('books'));
	console.log('execute application');
}
