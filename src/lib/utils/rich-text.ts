import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
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
	'h6'
];
const BLOCK_TAGS = ['p', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const URL_PROTOCOL_REGEX = /^(https?:|mailto:|tel:|\/|#)/i;
const TEXT_ALIGN_PATTERNS = [/^left$/i, /^center$/i, /^right$/i, /^justify$/i];
const BLOCK_TAG_REGEX = new RegExp(`<(?:${BLOCK_TAGS.join('|')})(?:\\s|>)`, 'i');
const SANITIZE_OPTIONS: import('sanitize-html').IOptions = {
	allowedTags: ALLOWED_TAGS,
	allowedAttributes: {
		a: ['href', 'rel'],
		p: ['style'],
		h1: ['style'],
		h2: ['style'],
		h3: ['style'],
		h4: ['style'],
		h5: ['style'],
		h6: ['style']
	},
	allowedStyles: {
		p: { 'text-align': TEXT_ALIGN_PATTERNS },
		h1: { 'text-align': TEXT_ALIGN_PATTERNS },
		h2: { 'text-align': TEXT_ALIGN_PATTERNS },
		h3: { 'text-align': TEXT_ALIGN_PATTERNS },
		h4: { 'text-align': TEXT_ALIGN_PATTERNS },
		h5: { 'text-align': TEXT_ALIGN_PATTERNS },
		h6: { 'text-align': TEXT_ALIGN_PATTERNS }
	},
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	allowedSchemesAppliedToAttributes: ['href'],
	allowProtocolRelative: false,
	transformTags: {
		div: (_tagName, attribs) => ({ tagName: 'p', attribs }),
		b: sanitizeHtml.simpleTransform('strong', {}),
		i: sanitizeHtml.simpleTransform('em', {}),
		strike: sanitizeHtml.simpleTransform('s', {}),
		del: sanitizeHtml.simpleTransform('s', {}),
		a: (_tagName, attribs): import('sanitize-html').Tag => {
			const href = sanitizeHref(attribs.href ?? null);
			return href
				? {
						tagName: 'a',
						attribs: {
							href,
							rel: 'noopener noreferrer'
						}
					}
				: {
						tagName: 'span',
						attribs: {}
					};
		}
	}
};

function escapeHtml(value: string): string {
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

function sanitizeHref(value: string | null): string | null {
	if (!value) return null;

	const href = value.trim();
	if (!href || !URL_PROTOCOL_REGEX.test(href)) {
		return null;
	}

	return href;
}

function plainTextToRichHtml(input: string): string {
	const normalized = decodeHtml(input).replace(/\r\n?/g, '\n').trim();
	if (!normalized) {
		return '';
	}

	const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => {
		return `<p>${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`;
	});

	return paragraphs.join('');
}

export function sanitizeRichTextHtml(input: string): string {
	const source = input.replace(/\r\n?/g, '\n').trim();
	if (!source) {
		return '';
	}

	if (!hasSupportedHtmlTag(source)) {
		return plainTextToRichHtml(source);
	}

	let sanitized = sanitizeHtml(source, SANITIZE_OPTIONS).trim();
	sanitized = sanitized.replace(/<p>\s*<\/p>/g, '');

	if (!sanitized.trim()) {
		return '';
	}

	if (!BLOCK_TAG_REGEX.test(sanitized)) {
		sanitized = `<p>${sanitized}</p>`;
	}

	return sanitized;
}
