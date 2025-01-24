import { Store } from '../lib/store/store.ts';

export async function initStore() {
	await Store.init();

	console.log('Store initialized');
	process.exit(0);
}
