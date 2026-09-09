import {
	parseDiffFromFile,
	processFile,
	type FileContents,
	type FileDiffMetadata
} from '@pierre/diffs';
import sanitizeHtml from 'sanitize-html';

export type EmailDiffInput = {
	currentSubject: string;
	currentBody: string;
	proposedSubject: string;
	proposedBody: string;
};

const MAX_LINE_DP_CELLS = 250_000;
const BOUNDED_PARSE_OPTIONS: NonNullable<Parameters<typeof parseDiffFromFile>[2]> & {
	maxEditLength: number;
} = {
	// jsdiff's Myers search is quadratic in the edit distance.
	maxEditLength: Math.floor(Math.sqrt(MAX_LINE_DP_CELLS))
};

/** Convert sanitized email HTML into readable plain text with line breaks. */
export function htmlToPlainText(html: string): string {
	return html
		.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<li[^>]*>/gi, '• ')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** Build the readable email document that Pierre compares. */
function emailToPlainText(subject: string, bodyHtml: string): string {
	const bodyText = htmlToPlainText(bodyHtml) || '(empty body)';
	const links: string[] = [];
	// Use the HTML parser so quote style, nested markup and encoded URL characters
	// cannot hide destination changes from the plain-text comparison.
	sanitizeHtml(bodyHtml, {
		allowedTags: ['a'],
		allowedAttributes: { a: ['href'] },
		exclusiveFilter(frame) {
			if (frame.tag === 'a' && frame.attribs.href) {
				const label = frame.text.replace(/\s+/g, ' ').trim() || '(unlabeled link)';
				links.push(`Link: ${label} → ${frame.attribs.href}`);
			}
			return false;
		}
	});
	return [
		`Subject: ${subject.trim() || '(no subject)'}`,
		'',
		bodyText,
		...(links.length ? ['', ...links] : [])
	].join('\n');
}

function emailFile(subject: string, bodyHtml: string): FileContents {
	return {
		name: 'email.txt',
		contents: emailToPlainText(subject, bodyHtml),
		lang: 'text'
	};
}

function buildWholeDocumentReplacement(
	currentFile: FileContents,
	proposedFile: FileContents
): FileDiffMetadata {
	const currentLines = currentFile.contents.split('\n');
	const proposedLines = proposedFile.contents.split('\n');
	const patch = [
		`--- ${currentFile.name}`,
		`+++ ${proposedFile.name}`,
		`@@ -1,${currentLines.length} +1,${proposedLines.length} @@`,
		...currentLines.map((line) => `-${line}`),
		...proposedLines.map((line) => `+${line}`)
	].join('\n');
	const diff = processFile(patch, {
		cacheKey: `${currentFile.cacheKey ?? currentFile.name}:${proposedFile.cacheKey ?? proposedFile.name}`,
		oldFile: currentFile,
		newFile: proposedFile,
		throwOnError: true
	});

	if (!diff) throw new Error('Unable to build bounded email diff metadata.');
	diff.lang = proposedFile.lang;
	return diff;
}

/** Parse the current and proposed email into Pierre's expandable diff metadata. */
export function buildEmailDiff(input: EmailDiffInput): FileDiffMetadata {
	const currentFile = emailFile(input.currentSubject, input.currentBody);
	const proposedFile = emailFile(input.proposedSubject, input.proposedBody);

	try {
		return parseDiffFromFile(currentFile, proposedFile, BOUNDED_PARSE_OPTIONS);
	} catch {
		return buildWholeDocumentReplacement(currentFile, proposedFile);
	}
}

export function countDiffChanges(diff: FileDiffMetadata): {
	additions: number;
	removals: number;
} {
	let additions = 0;
	let removals = 0;

	for (const hunk of diff.hunks) {
		for (const content of hunk.hunkContent) {
			if (content.type !== 'change') continue;
			additions += content.additions;
			removals += content.deletions;
		}
	}

	return { additions, removals };
}
