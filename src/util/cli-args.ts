import { parseArgs } from 'node:util';

export function parseCliArgs() {
	return parseArgs({
		args: Bun.argv,
		options: {
			checkBooks: {
				type: 'boolean',
			},
		},
		strict: true,
		allowPositionals: true,
	}).values;
}
