import {
	ALLOWED_TAG_SET,
	CONVEX_STORAGE_URL_PATTERN,
	DROP_CONTENT_TAG_SET,
	IMG_WIDTH_PATTERN,
	TAG_RENAMES,
	finalizeSanitizedRichTextHtml,
	hasSupportedHtmlTag,
	plainTextToRichHtml,
	sanitizeHref,
	sanitizeStyle
} from './rich-text-shared';

export { escapeHtml } from './rich-text-shared';

function sanitizeElement(element: Element, documentRef: Document): Node | null {
	const sourceTag = element.tagName.toLowerCase();
	const tagName = TAG_RENAMES[sourceTag] ?? sourceTag;

	if (DROP_CONTENT_TAG_SET.has(sourceTag)) {
		return documentRef.createTextNode('');
	}

	if (!ALLOWED_TAG_SET.has(tagName)) {
		const fragment = documentRef.createDocumentFragment();
		for (const child of Array.from(element.childNodes)) {
			const sanitized = sanitizeNode(child, documentRef);
			if (sanitized) fragment.append(sanitized);
		}
		return fragment;
	}

	if (tagName === 'img') {
		const src = element.getAttribute('src')?.trim() ?? '';
		if (!src || !CONVEX_STORAGE_URL_PATTERN.test(src)) {
			return documentRef.createTextNode('');
		}
	}

	const next = documentRef.createElement(tagName);

	if (tagName === 'a') {
		const href = sanitizeHref(element.getAttribute('href'));
		if (!href) {
			const span = documentRef.createElement('span');
			for (const child of Array.from(element.childNodes)) {
				const sanitized = sanitizeNode(child, documentRef);
				if (sanitized) span.append(sanitized);
			}
			return span;
		}
		next.setAttribute('href', href);
		next.setAttribute('rel', 'noopener noreferrer');
	}

	if (tagName === 'img') {
		next.setAttribute('src', element.getAttribute('src') ?? '');
		next.setAttribute('alt', element.getAttribute('alt') ?? '');
		for (const attr of ['width', 'height']) {
			const value = element.getAttribute(attr)?.trim();
			if (
				value &&
				(attr === 'height'
					? value === 'auto' || IMG_WIDTH_PATTERN.test(value)
					: IMG_WIDTH_PATTERN.test(value))
			) {
				next.setAttribute(attr, value);
			}
		}
	}

	const style = sanitizeStyle(tagName, element.getAttribute('style'));
	if (style) next.setAttribute('style', style);

	if (tagName !== 'br' && tagName !== 'img') {
		for (const child of Array.from(element.childNodes)) {
			const sanitized = sanitizeNode(child, documentRef);
			if (sanitized) next.append(sanitized);
		}
	}

	return next;
}

function sanitizeNode(node: Node, documentRef: Document): Node | null {
	if (node.nodeType === Node.TEXT_NODE) {
		return documentRef.createTextNode(node.textContent ?? '');
	}
	if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
		return sanitizeElement(node, documentRef);
	}
	return null;
}

function browserSanitizeHtml(source: string): string | null {
	if (typeof DOMParser === 'undefined') return null;

	const parser = new DOMParser();
	const parsed = parser.parseFromString(source, 'text/html');
	const fragment = parsed.createDocumentFragment();

	for (const child of Array.from(parsed.body.childNodes)) {
		const sanitized = sanitizeNode(child, parsed);
		if (sanitized) fragment.append(sanitized);
	}

	const container = parsed.createElement('div');
	container.append(fragment);
	return container.innerHTML;
}

export function sanitizeRichTextHtml(input: string): string {
	const source = input.replace(/\r\n?/g, '\n').trim();
	if (!source) return '';

	if (!hasSupportedHtmlTag(source)) {
		return plainTextToRichHtml(source);
	}

	const sanitized = browserSanitizeHtml(source);
	if (sanitized == null) {
		return plainTextToRichHtml(source);
	}

	return finalizeSanitizedRichTextHtml(sanitized);
}
