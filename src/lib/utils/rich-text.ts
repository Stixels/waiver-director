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
	'h6'
]);
const URL_PROTOCOL_REGEX = /^(https?:|mailto:|tel:|\/|#)/i;
const TEXT_ALIGN_REGEX = /text-align\s*:\s*(left|center|right|justify)/i;

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

function escapeAttribute(value: string): string {
	return escapeHtml(value).replaceAll('`', '&#96;');
}

function sanitizeHref(value: string | null): string | null {
	if (!value) return null;

	const href = value.trim();
	if (!href || !URL_PROTOCOL_REGEX.test(href)) {
		return null;
	}

	return href;
}

function sanitizeTextAlignStyle(attributes: string): string | null {
	const styleMatch = attributes.match(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
	const styleValue = styleMatch?.[1] ?? styleMatch?.[2] ?? styleMatch?.[3] ?? null;
	if (!styleValue) return null;

	const alignMatch = styleValue.match(TEXT_ALIGN_REGEX);
	if (!alignMatch) return null;

	return `text-align: ${alignMatch[1].toLowerCase()}`;
}

function normalizeTagName(tagName: string): string {
	switch (tagName.toLowerCase()) {
		case 'b':
			return 'strong';
		case 'i':
			return 'em';
		case 'strike':
		case 'del':
			return 's';
		default:
			return tagName.toLowerCase();
	}
}

function closeTag(stack: string[], output: string[], tagName: string) {
	if (!stack.includes(tagName)) {
		return;
	}

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) break;
		output.push(`</${current}>`);
		if (current === tagName) {
			break;
		}
	}
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

	if (!/[<>]/.test(source)) {
		return plainTextToRichHtml(source);
	}

	const normalizedSource = source
		.replace(/<\s*div(\s[^>]*)?>/gi, '<p>')
		.replace(/<\s*\/\s*div\s*>/gi, '</p>')
		.replace(/<\s*b(\s|>)/gi, '<strong$1')
		.replace(/<\s*\/\s*b\s*>/gi, '</strong>')
		.replace(/<\s*i(\s|>)/gi, '<em$1')
		.replace(/<\s*\/\s*i\s*>/gi, '</em>')
		.replace(/<\s*span[^>]*>/gi, '')
		.replace(/<\s*\/\s*span\s*>/gi, '');

	const tokenRegex = /<[^>]+>/g;
	const output: string[] = [];
	const stack: string[] = [];
	let cursor = 0;

	for (const match of normalizedSource.matchAll(tokenRegex)) {
		const token = match[0];
		const index = match.index ?? 0;
		output.push(escapeHtml(decodeHtml(normalizedSource.slice(cursor, index))));
		cursor = index + token.length;

		const closingMatch = token.match(/^<\s*\/\s*([a-z0-9]+)[^>]*>$/i);
		if (closingMatch) {
			const tagName = normalizeTagName(closingMatch[1]);
			if (tagName !== 'br' && ALLOWED_TAGS.has(tagName)) {
				closeTag(stack, output, tagName);
			}
			continue;
		}

		const openingMatch = token.match(/^<\s*([a-z0-9]+)([^>]*)>$/i);
		if (!openingMatch) {
			continue;
		}

		const tagName = normalizeTagName(openingMatch[1]);
		if (!ALLOWED_TAGS.has(tagName)) {
			continue;
		}

		if (tagName === 'br') {
			output.push('<br>');
			continue;
		}

		if (tagName === 'a') {
			const hrefMatch = openingMatch[2]?.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
			const href = sanitizeHref(hrefMatch?.[1] ?? hrefMatch?.[2] ?? hrefMatch?.[3] ?? null);
			if (!href) {
				continue;
			}

			output.push(`<a href="${escapeAttribute(href)}" rel="noopener noreferrer">`);
			stack.push('a');
			continue;
		}

		if (
			tagName === 'p' ||
			tagName === 'h1' ||
			tagName === 'h2' ||
			tagName === 'h3' ||
			tagName === 'h4' ||
			tagName === 'h5' ||
			tagName === 'h6'
		) {
			const textAlignStyle = sanitizeTextAlignStyle(openingMatch[2] ?? '');
			output.push(textAlignStyle ? `<${tagName} style="${textAlignStyle}">` : `<${tagName}>`);
			stack.push(tagName);
			continue;
		}

		output.push(`<${tagName}>`);
		stack.push(tagName);
	}

	output.push(escapeHtml(decodeHtml(normalizedSource.slice(cursor))));

	while (stack.length > 0) {
		const tagName = stack.pop();
		if (tagName) {
			output.push(`</${tagName}>`);
		}
	}

	let sanitized = output.join('');
	sanitized = sanitized.replace(/<p>\s*<\/p>/g, '');

	if (!sanitized.trim()) {
		return '';
	}

	if (!/<(?:p|ul|ol|li|h1|h2|h3|h4|h5|h6)>/.test(sanitized)) {
		sanitized = `<p>${sanitized}</p>`;
	}

	return sanitized;
}
