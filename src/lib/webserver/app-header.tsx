import type { Book } from '../../types/models/book.ts';

interface AppHeaderProps {
  books: Book[];
}

export function AppHeader({books}: AppHeaderProps) {
  const available = books.filter((book) => book.isAvailable).length;
  const borrowed = books.length - available;

  return (
    <header className="app-header">
      <h1 className="title">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 274 84" width="274" height="84" role="img" aria-label="bibo watch">
          <text x="0" y="58" font-family="BiboWatch" font-weight="500" font-style="normal" font-size="60" letter-spacing="-1" fill="#ECE7DD">bibo</text>
          <text x="106" y="58" font-family="BiboWatch" font-weight="400" font-style="italic" font-size="60" fill="#9E90EC">watch</text>
        </svg>

      </h1>
      <p className="subtitle">
        <span className="count-available">{available} verfügbar</span>
        <span className="count-sep">·</span>
        <span>{borrowed} ausgeliehen</span>
      </p>
    </header>
  );
}
