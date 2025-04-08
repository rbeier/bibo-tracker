import type { Book } from '../../types/models/book.ts';

interface BookListProps {
	books: Book[];
}

export function BookList({ books }: BookListProps) {
	return (
		<div className="list-container">
			{books.map((book) => (
				<div key={book.notionId}>
					<div className="book">
						{book.permalink ? (
							<a href={book.permalink} className="book-title">
								{book.title}
							</a>
						) : (
							<span className="book-title">{book.title}</span>
						)}

						<span className={`book-status ${book.isAvailable ? 'available' : 'unavailable'}`}>&nbsp;</span>
						<span className="book-meta-info">
							{book.location} {book.location ? '-' : ''} {book.author}
						</span>
					</div>
					<hr />
				</div>
			))}

			{books.length === 0 && <p>No books found.</p>}
		</div>
	);
}
