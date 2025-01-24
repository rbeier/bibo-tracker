import { parseArgs } from 'node:util';

export function parseCliArgs() {
	return parseArgs({
		args: Bun.argv,
		options: {
			init: {
				type: 'boolean',
			},
			reloadBooks: {
				type: 'boolean',
			},
			checkBooks: {
				type: 'boolean',
			},
		},
		strict: true,
		allowPositionals: true,
	}).values;
}
