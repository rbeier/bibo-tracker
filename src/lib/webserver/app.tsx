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
				<link rel="preconnect" href="https://fonts.googleapis.com" />
				<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
				<link
					href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=IBM+Plex+Mono:wght@500&display=swap"
					rel="stylesheet"
				/>
				<title>bibowatch</title>
				<style>{styles}</style>
			</head>
			<body>
				<div className="container">
					<AppHeader books={books} />
					<BookList books={books} />
					<Status lastChecked={lastChecked} />
				</div>
			</body>
		</html>
	);
}
