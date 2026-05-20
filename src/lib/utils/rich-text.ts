import sanitizeHtml from 'sanitize-html';
import {
	ALLOWED_TAGS,
	CONVEX_STORAGE_URL_PATTERN,
	FONT_FAMILY_PATTERN,
	FONT_SIZE_PATTERN,
	IMG_OBJECT_FIT_PATTERN,
	IMG_WIDTH_PATTERN,
	TEXT_ALIGN_PATTERNS,
	finalizeSanitizedRichTextHtml,
	hasSupportedHtmlTag,
	plainTextToRichHtml,
	sanitizeHref
} from './rich-text-shared';

export { escapeHtml } from './rich-text-shared';

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
		h6: ['style'],
		span: ['style'],
		img: ['src', 'alt', 'width', 'height', 'style']
	},
	allowedStyles: {
		p: { 'text-align': TEXT_ALIGN_PATTERNS },
		h1: { 'text-align': TEXT_ALIGN_PATTERNS },
		h2: { 'text-align': TEXT_ALIGN_PATTERNS },
		h3: { 'text-align': TEXT_ALIGN_PATTERNS },
		h4: { 'text-align': TEXT_ALIGN_PATTERNS },
		h5: { 'text-align': TEXT_ALIGN_PATTERNS },
		h6: { 'text-align': TEXT_ALIGN_PATTERNS },
		span: {
			'font-family': [FONT_FAMILY_PATTERN],
			'font-size': [FONT_SIZE_PATTERN]
		},
		img: {
			width: [IMG_WIDTH_PATTERN],
			'max-width': [IMG_WIDTH_PATTERN],
			height: [/^auto$/, IMG_WIDTH_PATTERN],
			'object-fit': [IMG_OBJECT_FIT_PATTERN],
			display: [/^(?:block|inline|inline-block)$/i],
			'margin-left': [/^(?:auto|0|0px)$/i],
			'margin-right': [/^(?:auto|0|0px)$/i]
		}
	},
	allowedSchemes: ['http', 'https', 'mailto', 'tel'],
	allowedSchemesAppliedToAttributes: ['href', 'src'],
	allowProtocolRelative: false,
	selfClosing: ['img', 'br'],
	transformTags: {
		div: (_tagName, attribs) => ({ tagName: 'p', attribs }),
		b: sanitizeHtml.simpleTransform('strong', {}),
		i: sanitizeHtml.simpleTransform('em', {}),
		button: sanitizeHtml.simpleTransform('span', {}),
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
		},
		img: (_tagName, attribs): import('sanitize-html').Tag => {
			const src = (attribs.src ?? '').trim();
			if (!src || !CONVEX_STORAGE_URL_PATTERN.test(src)) {
				return { tagName: 'span', attribs: {} };
			}
			const next: Record<string, string> = { src, alt: attribs.alt ?? '' };
			if (attribs.width) next.width = attribs.width;
			if (attribs.height) next.height = attribs.height;
			if (attribs.style) next.style = attribs.style;
			return { tagName: 'img', attribs: next };
		}
	}
};

export function sanitizeRichTextHtml(input: string): string {
	const source = input.replace(/\r\n?/g, '\n').trim();
	if (!source) {
		return '';
	}

	if (!hasSupportedHtmlTag(source)) {
		return plainTextToRichHtml(source);
	}

	return finalizeSanitizedRichTextHtml(sanitizeHtml(source, SANITIZE_OPTIONS));
}
