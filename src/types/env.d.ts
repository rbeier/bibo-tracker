declare module 'bun' {
	interface Env {
		NOTION_API_KEY: string;
		NOTION_DATABASE_ID: string;
		WEBSERVER_PORT: string;
	}
}
