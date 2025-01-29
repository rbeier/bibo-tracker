import type { Book } from '../../types/models/book.ts';

interface BookListProps {
	books: Book[];
}

export function BookList({ books }: BookListProps) {
	return (
		<div className="list-container">
			{books.map((book) => (
				<article key={book.notionId} className={`book ${book.isAvailable ? 'available' : 'unavailable'}`}>
					<h4>{book.title}</h4>
					<p className="author">{book.author}</p>
				</article>
			))}
			{books.length === 0 && <p>No books found.</p>}
		</div>
	);
}
