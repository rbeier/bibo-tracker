export type SyncBookInput = {
	id: string;
	title: string;
	author?: string | null;
};

export type SyncBooksRequest = {
	books: SyncBookInput[];
	allowEmpty?: boolean;
};

export type SyncBooksResponse = {
	syncedAt: string;
	total: number;
	added: number;
	updated: number;
	unchanged: number;
	removed: number;
	scrapeTriggered: boolean;
};

export function validateSyncBooksRequest(
	payload: unknown,
): { ok: true; data: SyncBooksRequest } | { ok: false; details: string[] } {
	const details: string[] = [];

	if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
		return { ok: false, details: ['Request body must be a JSON object'] };
	}

	const record = payload as Record<string, unknown>;
	if (!Array.isArray(record.books)) {
		return { ok: false, details: ['"books" must be an array'] };
	}
	if (record.books.length > 1000) {
		return { ok: false, details: ['"books" must not exceed 1000 items'] };
	}
	if (record.allowEmpty !== undefined && typeof record.allowEmpty !== 'boolean') {
		details.push('"allowEmpty" must be a boolean when provided');
	}

	const seenIds = new Set<string>();
	const normalizedBooks: SyncBookInput[] = [];

	record.books.forEach((item, index) => {
		if (typeof item !== 'object' || item === null || Array.isArray(item)) {
			details.push(`books[${index}] must be an object`);
			return;
		}
		const b = item as Record<string, unknown>;
		const id = typeof b.id === 'string' ? b.id.trim() : '';
		const title = typeof b.title === 'string' ? b.title.trim() : '';

		if (!id || id.length > 256) {
			details.push(`books[${index}].id must be a non-empty string (max 256 chars)`);
		} else if (seenIds.has(id)) {
			details.push(`books[${index}].id "${id}" is duplicated in payload`);
		} else {
			seenIds.add(id);
		}

		if (!title || title.length > 500) {
			details.push(`books[${index}].title must be a non-empty string (max 500 chars)`);
		}

		if (b.author !== undefined && b.author !== null && typeof b.author !== 'string') {
			details.push(`books[${index}].author must be a string, null, or omitted`);
		} else if (typeof b.author === 'string' && b.author.trim().length > 500) {
			details.push(`books[${index}].author must not exceed 500 chars`);
		}

		normalizedBooks.push({
			id,
			title,
			author: typeof b.author === 'string' ? b.author.trim() : '',
		});
	});

	if (details.length > 0) {
		return { ok: false, details };
	}

	return {
		ok: true,
		data: {
			books: normalizedBooks,
			allowEmpty: record.allowEmpty === true,
		},
	};
}
