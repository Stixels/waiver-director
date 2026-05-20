export const ALLOWED_TAGS = [
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
];

export const ALLOWED_TAG_SET = new Set<string>(ALLOWED_TAGS);
export const DROP_CONTENT_TAG_SET = new Set<string>(['script', 'style']);

export const TAG_RENAMES: Record<string, string> = {
	b: 'strong',
	i: 'em',
	strike: 's',
	del: 's',
	div: 'p',
	button: 'span'
};

export const IMG_WIDTH_PATTERN = /^[1-9][0-9]{0,3}(?:px|%)?$/;
export const IMG_OBJECT_FIT_PATTERN = /^(?:contain|cover|fill|none|scale-down)$/i;
export const CONVEX_STORAGE_URL_PATTERN =
	/^https?:\/\/(?:[a-z0-9-]+\.convex\.(?:cloud|site|dev)|127\.0\.0\.1(?::\d+)?|localhost(?::\d+)?)\/api\/storage\//i;

const SAFE_FONT_TOKEN =
	'(?:Arial|Helvetica|Georgia|["\']Times New Roman["\']|Times|Verdana|Geneva|Tahoma|["\']Courier New["\']|Courier|sans-serif|serif|monospace)';

export const FONT_FAMILY_PATTERN = new RegExp(
	`^${SAFE_FONT_TOKEN}(?:\\s*,\\s*${SAFE_FONT_TOKEN})*$`
);
export const FONT_SIZE_PATTERN = /^(?:12|14|16|18|20|24|30|36)px$/;
export const BLOCK_TAGS = ['p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
export const BLOCK_TAG_REGEX = new RegExp(`<(?:${BLOCK_TAGS.join('|')})(?:\\s|>)`, 'i');
export const URL_PROTOCOL_REGEX = /^(https?:|mailto:|tel:|\/|#)/i;
export const TEXT_ALIGN_PATTERNS = [/^left$/i, /^center$/i, /^right$/i, /^justify$/i];

export function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function decodeHtml(value: string): string {
	return value
		.replaceAll('&nbsp;', ' ')
		.replaceAll('&amp;', '&')
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'");
}

export function hasSupportedHtmlTag(input: string): boolean {
	return /<\/?[a-z][^>]*>/i.test(input);
}

export function sanitizeHref(value: string | null): string | null {
	if (!value) return null;

	const href = value.trim();
	if (!href || !URL_PROTOCOL_REGEX.test(href)) {
		return null;
	}

	return href;
}

export function plainTextToRichHtml(input: string): string {
	const normalized = decodeHtml(input).replace(/\r\n?/g, '\n').trim();
	if (!normalized) {
		return '';
	}

	const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => {
		return `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`;
	});

	return paragraphs.join('');
}

export function sanitizeStyle(tagName: string, style: string | null): string | null {
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

function normalizeVoidTags(input: string): string {
	return input
		.replace(/<br\s*\/?>/gi, '<br />')
		.replace(/<\/br\s*>/gi, '')
		.replace(/<img\b([^>]*?)\s*\/?>/gi, (_match, attrs: string) => `<img${attrs} />`)
		.replace(/<\/img\s*>/gi, '');
}

function removeEmptyInlinePlaceholders(input: string): string {
	let next = input;
	let previous = '';

	while (next !== previous) {
		previous = next;
		next = next.replace(/<span>\s*<\/span>/gi, '');
	}

	return next;
}

export function finalizeSanitizedRichTextHtml(input: string): string {
	let sanitized = normalizeVoidTags(input.trim());
	sanitized = removeEmptyInlinePlaceholders(sanitized);
	sanitized = sanitized.replace(/<p\b[^>]*>\s*<\/p>/g, '');

	if (!sanitized.trim()) {
		return '';
	}

	if (!BLOCK_TAG_REGEX.test(sanitized)) {
		sanitized = `<p>${sanitized}</p>`;
	}

	return normalizeVoidTags(sanitized);
}
