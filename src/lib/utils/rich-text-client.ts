const ALLOWED_TAGS = new Set([
	'p',
	'br',
	'strong',
	'em',
	'u',
	's',
	'ul',
	'ol',
	'li',
	'a',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'span',
	'img'
]);

const TAG_RENAMES: Record<string, string> = {
	b: 'strong',
	i: 'em',
	strike: 's',
	del: 's',
	div: 'p',
	button: 'span'
};

const BLOCK_TAGS = ['p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const BLOCK_TAG_REGEX = new RegExp(`<(?:${BLOCK_TAGS.join('|')})(?:\\s|>)`, 'i');
const URL_PROTOCOL_REGEX = /^(https?:|mailto:|tel:|\/|#)/i;
const IMG_WIDTH_PATTERN = /^[1-9][0-9]{0,3}(?:px|%)?$/;
const IMG_OBJECT_FIT_PATTERN = /^(?:contain|cover|fill|none|scale-down)$/i;
const CONVEX_STORAGE_URL_PATTERN =
	/^https?:\/\/(?:[a-z0-9-]+\.convex\.(?:cloud|site|dev)|127\.0\.0\.1(?::\d+)?|localhost(?::\d+)?)\/api\/storage\//i;
const FONT_FAMILY_PATTERN =
	/^(?:Arial|Helvetica|Georgia|["']Times New Roman["']|Times|Verdana|Geneva|Tahoma|["']Courier New["']|Courier|sans-serif|serif|monospace)(?:\s*,\s*(?:Arial|Helvetica|Georgia|["']Times New Roman["']|Times|Verdana|Geneva|Tahoma|["']Courier New["']|Courier|sans-serif|serif|monospace))*$/;
const FONT_SIZE_PATTERN = /^(?:12|14|16|18|20|24|30|36)px$/;

export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function decodeHtml(value: string): string {
	return value
		.replaceAll('&nbsp;', ' ')
		.replaceAll('&amp;', '&')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'");
}

function hasSupportedHtmlTag(input: string): boolean {
	return /<\/?[a-z][^>]*>/i.test(input);
}

function plainTextToRichHtml(input: string): string {
	const normalized = decodeHtml(input).replace(/\r\n?/g, '\n').trim();
	if (!normalized) return '';
	return normalized
		.split(/\n{2,}/)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
		.join('');
}

function sanitizeHref(value: string | null): string | null {
	const href = value?.trim() ?? '';
	return href && URL_PROTOCOL_REGEX.test(href) ? href : null;
}

function sanitizeStyle(tagName: string, style: string | null): string | null {
	if (!style) return null;

	const next: string[] = [];
	for (const declaration of style.split(';')) {
		const [rawProperty, ...rawValueParts] = declaration.split(':');
		const property = rawProperty?.trim().toLowerCase();
		const value = rawValueParts.join(':').trim();
		if (!property || !value) continue;

		if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
			if (property === 'text-align' && /^(?:left|center|right|justify)$/i.test(value)) {
				next.push(`${property}:${value}`);
			}
			continue;
		}

		if (tagName === 'span') {
			if (property === 'font-family' && FONT_FAMILY_PATTERN.test(value)) {
				next.push(`${property}:${value}`);
			}
			if (property === 'font-size' && FONT_SIZE_PATTERN.test(value)) {
				next.push(`${property}:${value}`);
			}
			continue;
		}

		if (tagName === 'img') {
			if (['width', 'max-width'].includes(property) && IMG_WIDTH_PATTERN.test(value)) {
				next.push(`${property}:${value}`);
			}
			if (property === 'height' && (value === 'auto' || IMG_WIDTH_PATTERN.test(value))) {
				next.push(`${property}:${value}`);
			}
			if (property === 'object-fit' && IMG_OBJECT_FIT_PATTERN.test(value)) {
				next.push(`${property}:${value}`);
			}
			if (property === 'display' && /^(?:block|inline|inline-block)$/i.test(value)) {
				next.push(`${property}:${value}`);
			}
			if (['margin-left', 'margin-right'].includes(property) && /^(?:auto|0|0px)$/i.test(value)) {
				next.push(`${property}:${value}`);
			}
		}
	}

	return next.length > 0 ? next.join(';') : null;
}

function sanitizeElement(element: Element, documentRef: Document): Node | null {
	const sourceTag = element.tagName.toLowerCase();
	const tagName = TAG_RENAMES[sourceTag] ?? sourceTag;

	if (!ALLOWED_TAGS.has(tagName)) {
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

function fallbackSanitizeHtml(source: string): string {
	return source
		.replace(/<script\b[\s\S]*?<\/script>/gi, '')
		.replace(/<style\b[\s\S]*?<\/style>/gi, '')
		.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
		.replace(/\s(?:href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\1/gi, '');
}

export function sanitizeRichTextHtml(input: string): string {
	const source = input.replace(/\r\n?/g, '\n').trim();
	if (!source) return '';

	if (!hasSupportedHtmlTag(source)) {
		return plainTextToRichHtml(source);
	}

	let sanitized = (browserSanitizeHtml(source) ?? fallbackSanitizeHtml(source)).trim();
	sanitized = sanitized.replace(/<p\b[^>]*>\s*<\/p>/g, '');

	if (!sanitized.trim()) return '';
	if (!BLOCK_TAG_REGEX.test(sanitized)) {
		sanitized = `<p>${sanitized}</p>`;
	}

	return sanitized;
}
