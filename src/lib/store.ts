import type { State } from '../types/state.ts';

let jsonStore: State | undefined;
const storePath = './store/store.json';

try {
	jsonStore = await Bun.file(storePath).json();
} catch (_) {}

const initialState: State = {
	books: [],
};

// biome-ignore lint/complexity/noStaticOnlyClass: Exception for Store class
export class Store {
	static #state: State = (jsonStore as State) || {};

	// biome-ignore lint/suspicious/noExplicitAny: value can't be type checked against State type
	static setItem(key: keyof State, value: any) {
		Store.#state[key] = value;
		Store.#writeJsonStore(Store.#state);
	}

	static getItem(key: keyof State) {
		return Store.#state[key];
	}

	static getState() {
		return Store.#state;
	}

	static async init() {
		await Store.#writeJsonStore(initialState);
		console.log('Store initialized');
		process.exit(0);
	}

	static #writeJsonStore = async (state: State) => {
		return Bun.write(storePath, JSON.stringify(state));
	};

	static checkExistence() {
		if (!jsonStore) {
			console.error('Store not initialized. Run with --init flag');
			process.exit(1);
		}
	}
}
