import type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';

export type RichTextProperty = {
	id: string;
	type: 'rich_text';
	rich_text: Array<RichTextItemResponse>;
};
