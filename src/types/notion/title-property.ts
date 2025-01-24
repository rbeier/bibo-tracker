import type { RichTextItemResponse } from '@notionhq/client/build/src/api-endpoints';

export type TitleProperty = {
	id: string;
	type: 'title';
	title: Array<RichTextItemResponse>;
};
