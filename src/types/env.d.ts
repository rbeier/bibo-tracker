declare module 'bun' {
	interface Env {
		NOTION_API_KEY: string;
		NOTION_DATABASE_ID: string;
		ENVIRONMENT?: string;

		NTFY_URL?: string;
		NTFY_TOPIC?: string;
		NTFY_API_KEY?: string;
	}
}
