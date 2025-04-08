import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints';
import type { Book } from '../types/models/book.ts';
import type { CheckboxProperty } from '../types/notion/checkbox-property.ts';
import type { RichTextProperty } from '../types/notion/rich-text-property.ts';
import type { TitleProperty } from '../types/notion/title-property.ts';
import type { UrlProperty } from '../types/notion/url-property.ts';

export function notionPageToBook(page: PageObjectResponse): Book {
	return {
		notionId: page.id,
		author: getRichTextPropertyValue(page.properties.Autor as RichTextProperty),
		title: getTitlePropertyValue(page.properties.Titel as TitleProperty),
		isAvailable: getCheckboxPropertyValue(page.properties.Verfügbar as CheckboxProperty),
		location: getRichTextPropertyValue(page.properties.Standort as RichTextProperty),
		permalink: getUrlPropertyValue(page.properties.Link as UrlProperty),
	};
}

export function getRichTextPropertyValue(property: RichTextProperty) {
	return property.rich_text[0]?.plain_text;
}

export function getTitlePropertyValue(property: TitleProperty) {
	return property.title[0]?.plain_text;
}

export function getCheckboxPropertyValue(property: CheckboxProperty) {
	return property.checkbox;
}

export function getUrlPropertyValue(property: UrlProperty) {
	return property.url;
}
