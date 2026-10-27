import { DateTime } from 'luxon';
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

function formatReturnDate(book: Book): string {
	if (book.isAvailable || !book.returnDate) {
		return '';
	}
	const dt = DateTime.fromISO(book.returnDate);
	return dt.isValid ? `bis ${dt.toFormat('dd.MM.yyyy')}` : '';
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

	let warningSymbolRendered = false;

	return (
		<div className="list-container">
			{sorted.map((book) => {
				const { code, rest } = splitLocation(book.location);
				const returnInfo = formatReturnDate(book);
				const meta = [rest, book.author, returnInfo].filter(Boolean).join(' · ');
				const hasScrapeError = Boolean(book.scrapeError);
				const shouldDefineSymbol = hasScrapeError && !warningSymbolRendered;
				if (shouldDefineSymbol) {
					warningSymbolRendered = true;
				}

				return (
					<div className="book" key={book.id}>
						<span
							className={`book-status ${book.isAvailable ? 'available' : 'unavailable'}`}
							title={book.isAvailable ? 'Verfügbar' : 'Ausgeliehen'}
						>
							&nbsp;
						</span>
						<div className="book-body">
							<div className="book-title-row">
								{book.permalink ? (
									<a href={book.permalink} className="book-title">
										{book.title}
									</a>
								) : (
									<span className="book-title">{book.title}</span>
								)}
								{hasScrapeError && (
									<span
										className="book-warning"
										role="img"
										aria-label="Fehler beim letzten Abruf"
										title="Fehler beim letzten Abruf"
									>
										<svg width="14" height="14" aria-hidden="true" className="book-warning-icon">
											{shouldDefineSymbol && (
												<symbol
													id="bibo-icon-warning"
													viewBox="0 0 16 16"
													fill="none"
													stroke="currentColor"
													strokeWidth="1.5"
													strokeLinecap="round"
													strokeLinejoin="round"
												>
													<path d="M8 2.25 14.25 13.25H1.75L8 2.25Z" />
													<path d="M8 6.5v3" />
													<circle cx="8" cy="11.5" r="0.6" fill="currentColor" stroke="none" />
												</symbol>
											)}
											<use href="#bibo-icon-warning" />
										</svg>
									</span>
								)}
							</div>
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
