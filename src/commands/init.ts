import type { Store } from '../types/Store.ts';

export default function init() {
  const initialStore: Store = {
    books: []
  };

  const filePath = './store/store.json';

  Bun.write(filePath, JSON.stringify(initialStore))
    .then(() => console.log('Store initialized'))
    .catch((error) => console.error(`Error initializing store: ${error}`));
}
