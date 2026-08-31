import { parseDiffFromFile, type FileContents, type FileDiffMetadata } from '@pierre/diffs';

export type EmailDiffInput = {
	currentSubject: string;
	currentBody: string;
	proposedSubject: string;
	proposedBody: string;
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
	return [`Subject: ${subject.trim() || '(no subject)'}`, '', bodyText].join('\n');
}

function emailFile(subject: string, bodyHtml: string): FileContents {
	return {
		name: 'email.txt',
		contents: emailToPlainText(subject, bodyHtml),
		lang: 'text'
	};
}

/** Parse the current and proposed email into Pierre's expandable diff metadata. */
export function buildEmailDiff(input: EmailDiffInput): FileDiffMetadata {
	return parseDiffFromFile(
		emailFile(input.currentSubject, input.currentBody),
		emailFile(input.proposedSubject, input.proposedBody)
	);
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
