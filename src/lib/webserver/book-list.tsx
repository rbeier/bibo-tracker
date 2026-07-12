import type { Book } from '../../types/models/book.ts';

interface BookListProps {
	books: Book[];
}

// Split a shelf location like "R 11 Thriller" into a compact code tag ("R 11")
// and the remaining descriptive text ("Thriller"). Degrades gracefully when the
// location does not match the expected pattern.
function splitLocation(location?: string): { code: string; rest: string } {
	if (!location) {
		return { code: '', rest: '' };
	}
	const match = location.match(/^([A-Za-zÄÖÜ]{1,2}\s?\d+)\s*(.*)$/);
	if (match) {
		return { code: match[1], rest: match[2].trim() };
	}
	return { code: '', rest: location };
}

export function BookList({ books }: BookListProps) {
	// available books first, otherwise keep incoming order
	const sorted = [...books].sort((a, b) => Number(b.isAvailable) - Number(a.isAvailable));

	if (sorted.length === 0) {
		return (
			<div className="list-container">
				<p>Keine Bücher gefunden.</p>
			</div>
		);
	}

	return (
		<div className="list-container">
			{sorted.map((book) => {
				const { code, rest } = splitLocation(book.location);
				const meta = [rest, book.author].filter(Boolean).join(' · ');

				return (
					<div className="book" key={book.notionId}>
						<span
							className={`book-status ${book.isAvailable ? 'available' : 'unavailable'}`}
							title={book.isAvailable ? 'Verfügbar' : 'Ausgeliehen'}
						>
							&nbsp;
						</span>
						<div className="book-body">
							{book.permalink ? (
								<a href={book.permalink} className="book-title">
									{book.title}
								</a>
							) : (
								<span className="book-title">{book.title}</span>
							)}
							<div className="book-meta-info">
								{code && <span className="book-tag">{code}</span>}
								{meta && <span className="book-meta-text">{meta}</span>}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
}
