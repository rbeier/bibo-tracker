import type { Book } from '../../types/models/book.ts';
import { AppHeader } from './app-header.tsx';
import { BookList } from './book-list.tsx';

const styles = await Bun.file('src/lib/webserver/app.css').text();

interface AppProps {
	books: Book[];
}

export default function App({ books }: AppProps) {
	return (
		<html lang="de" data-theme="dark">
			<head lang="de">
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.jade.min.css" />
				<title>Bibo Tracker</title>
				<style>{styles}</style>
			</head>
			<body>
				<div className="container">
					<AppHeader />
					<hr />
					<BookList books={books} />
				</div>
			</body>
		</html>
	);
}
