import type { State } from './types/state.ts';
import initialState from '../store/store.json';

export class Store {
  #state: State = initialState;

  setItem(key: keyof State, value: any) {
    this.#state[key] = value;

    Bun.write('./store/store.json', JSON.stringify(this.#state))
      .then(() => console.log('Store updated'))
      .catch((error) => console.log(error));
  }

  getItem(key: keyof State) {
    return this.#state[key];
  }
}
