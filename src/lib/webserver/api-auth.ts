import { createHash, timingSafeEqual } from 'node:crypto';

export type AuthCheckResult = { ok: true } | { ok: false; status: 401 | 503; error: string };

function sha256(value: string): Buffer {
	return createHash('sha256').update(value, 'utf8').digest();
}

export function verifyApiAuth(request: Request): AuthCheckResult {
	const configuredKey = Bun.env.API_KEY?.trim();
	if (!configuredKey) {
		return { ok: false, status: 503, error: 'Sync API is not configured' };
	}

	const header = request.headers.get('Authorization') ?? '';
	const match = header.match(/^Bearer\s+(.+)$/i);
	if (!match) {
		return { ok: false, status: 401, error: 'Unauthorized' };
	}

	const providedToken = match[1].trim();
	if (!providedToken) {
		return { ok: false, status: 401, error: 'Unauthorized' };
	}

	const isValid = timingSafeEqual(sha256(configuredKey), sha256(providedToken));
	if (!isValid) {
		return { ok: false, status: 401, error: 'Unauthorized' };
	}

	return { ok: true };
}
