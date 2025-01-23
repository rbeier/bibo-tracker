import type { State } from '../types/state.ts';

export default function init() {
  const initialState: State = {
    books: []
  };

  const filePath = './store/store.json';

  Bun.write(filePath, JSON.stringify(initialState))
    .then(() => console.log('Store initialized'))
    .catch((error) => console.error(`Error initializing store: ${error}`));
}
