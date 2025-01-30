import type { State } from '../../types/models/state.ts';

export namespace Store {
	export const state: State = {
		lastChecked: null,
	};

	export function updateLastChecked() {
		state.lastChecked = new Date();
	}
}
