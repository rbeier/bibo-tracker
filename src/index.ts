import { parseArgs } from 'node:util';
import initApplication from './commands/init.ts';

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
	initApplication();
}
