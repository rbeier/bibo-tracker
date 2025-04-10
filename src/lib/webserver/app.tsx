import type { Book } from '../../types/models/book.ts';
import { AppHeader } from './app-header.tsx';
import { BookList } from './book-list.tsx';
import { Status } from './status.tsx';

const styles = await Bun.file('src/lib/webserver/app.css').text();

interface AppProps {
	books: Book[];
	lastChecked?: Date | null;
}

export default function App({ books, lastChecked }: AppProps) {
	return (
		<html lang="de" data-theme="dark">
			<head lang="de">
				<meta charSet="UTF-8" />
				<link
					rel="icon"
					href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📚</text></svg>"
				/>
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
				<title>Bibo Tracker</title>
				<style>{styles}</style>
			</head>
			<body>
				<div className="container">
					<AppHeader />
					<hr />
					<BookList books={books} />
					<Status lastChecked={lastChecked} />
				</div>
			</body>
		</html>
	);
}
