declare module 'bun' {
	interface Env {
		API_KEY?: string;
		DATABASE_PATH?: string;
		ENVIRONMENT?: string;

		NTFY_URL?: string;
		NTFY_TOPIC?: string;
		NTFY_API_KEY?: string;
	}
}
