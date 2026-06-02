export type DiffSegmentType = 'same' | 'add' | 'remove';

export type DiffSegment = {
	type: DiffSegmentType;
	text: string;
};

export type DiffLineType = 'same' | 'add' | 'remove';

export type DiffLine = {
	id: string;
	type: DiffLineType;
	oldNumber: number | null;
	newNumber: number | null;
	segments: DiffSegment[];
};

export type EmailDiffInput = {
	currentSubject: string;
	currentBody: string;
	proposedSubject: string;
	proposedBody: string;
};

const MAX_LINE_DP_CELLS = 250_000;
const MAX_WORD_DP_TOKENS = 700;

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

/** Build the "document" of lines we diff: a subject line, a spacer, then body lines. */
function emailToLines(subject: string, bodyHtml: string): string[] {
	const bodyText = htmlToPlainText(bodyHtml) || '(empty body)';
	return [`Subject: ${subject.trim() || '(no subject)'}`, '', ...bodyText.split('\n')];
}

function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
	const merged: DiffSegment[] = [];
	for (const segment of segments) {
		if (!segment.text) continue;
		const previous = merged.at(-1);
		if (previous && previous.type === segment.type) {
			previous.text += segment.text;
		} else {
			merged.push({ ...segment });
		}
	}
	return merged;
}

/** Word-level diff between two single lines, returning interleaved segments. */
function diffWords(oldLine: string, newLine: string): DiffSegment[] {
	const oldTokens = oldLine.match(/\s+|[^\s]+/g) ?? [];
	const newTokens = newLine.match(/\s+|[^\s]+/g) ?? [];

	if (oldTokens.length + newTokens.length > MAX_WORD_DP_TOKENS) {
		return mergeSegments([
			{ type: 'remove', text: oldLine },
			{ type: 'add', text: newLine }
		]);
	}

	const rows = oldTokens.length + 1;
	const cols = newTokens.length + 1;
	const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

	for (let i = oldTokens.length - 1; i >= 0; i -= 1) {
		for (let j = newTokens.length - 1; j >= 0; j -= 1) {
			dp[i][j] =
				oldTokens[i] === newTokens[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	const segments: DiffSegment[] = [];
	let i = 0;
	let j = 0;
	while (i < oldTokens.length && j < newTokens.length) {
		if (oldTokens[i] === newTokens[j]) {
			segments.push({ type: 'same', text: oldTokens[i] });
			i += 1;
			j += 1;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			segments.push({ type: 'remove', text: oldTokens[i] });
			i += 1;
		} else {
			segments.push({ type: 'add', text: newTokens[j] });
			j += 1;
		}
	}
	while (i < oldTokens.length) segments.push({ type: 'remove', text: oldTokens[i++] });
	while (j < newTokens.length) segments.push({ type: 'add', text: newTokens[j++] });

	return mergeSegments(segments);
}

type LineOp = { type: DiffLineType; text: string };

function diffLineOps(oldLines: string[], newLines: string[]): LineOp[] {
	const n = oldLines.length;
	const m = newLines.length;

	// Guard against pathological inputs: fall back to a whole-block replacement.
	if (n * m > MAX_LINE_DP_CELLS) {
		return [
			...oldLines.map((text): LineOp => ({ type: 'remove', text })),
			...newLines.map((text): LineOp => ({ type: 'add', text }))
		];
	}

	const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i -= 1) {
		for (let j = m - 1; j >= 0; j -= 1) {
			dp[i][j] =
				oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	const ops: LineOp[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (oldLines[i] === newLines[j]) {
			ops.push({ type: 'same', text: oldLines[i] });
			i += 1;
			j += 1;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			ops.push({ type: 'remove', text: oldLines[i] });
			i += 1;
		} else {
			ops.push({ type: 'add', text: newLines[j] });
			j += 1;
		}
	}
	while (i < n) ops.push({ type: 'remove', text: oldLines[i++] });
	while (j < m) ops.push({ type: 'add', text: newLines[j++] });

	return ops;
}

/**
 * Build a code-editor-style line diff between the current and proposed email.
 * Consecutive removed/added lines are paired so changed lines get word-level highlights.
 */
export function buildEmailDiff(input: EmailDiffInput): DiffLine[] {
	const oldLines = emailToLines(input.currentSubject, input.currentBody);
	const newLines = emailToLines(input.proposedSubject, input.proposedBody);
	const ops = diffLineOps(oldLines, newLines);

	const lines: DiffLine[] = [];
	let oldNumber = 0;
	let newNumber = 0;
	let index = 0;
	let cursor = 0;

	const pushLine = (line: Omit<DiffLine, 'id'>) => {
		lines.push({ ...line, id: `${line.type}:${index++}` });
	};

	while (cursor < ops.length) {
		const op = ops[cursor];

		if (op.type === 'same') {
			oldNumber += 1;
			newNumber += 1;
			pushLine({
				type: 'same',
				oldNumber,
				newNumber,
				segments: [{ type: 'same', text: op.text }]
			});
			cursor += 1;
			continue;
		}

		const removes: string[] = [];
		const adds: string[] = [];
		while (cursor < ops.length && ops[cursor].type === 'remove') removes.push(ops[cursor++].text);
		while (cursor < ops.length && ops[cursor].type === 'add') adds.push(ops[cursor++].text);

		const pairs = Math.min(removes.length, adds.length);
		for (let p = 0; p < pairs; p += 1) {
			const wordSegments = diffWords(removes[p], adds[p]);
			oldNumber += 1;
			pushLine({
				type: 'remove',
				oldNumber,
				newNumber: null,
				segments: mergeSegments(wordSegments.filter((segment) => segment.type !== 'add'))
			});
			newNumber += 1;
			pushLine({
				type: 'add',
				oldNumber: null,
				newNumber,
				segments: mergeSegments(wordSegments.filter((segment) => segment.type !== 'remove'))
			});
		}
		for (let p = pairs; p < removes.length; p += 1) {
			oldNumber += 1;
			pushLine({
				type: 'remove',
				oldNumber,
				newNumber: null,
				segments: [{ type: 'same', text: removes[p] }]
			});
		}
		for (let p = pairs; p < adds.length; p += 1) {
			newNumber += 1;
			pushLine({
				type: 'add',
				oldNumber: null,
				newNumber,
				segments: [{ type: 'same', text: adds[p] }]
			});
		}
	}

	return lines;
}

export function countDiffChanges(lines: DiffLine[]): { additions: number; removals: number } {
	let additions = 0;
	let removals = 0;
	for (const line of lines) {
		if (line.type === 'add') additions += 1;
		else if (line.type === 'remove') removals += 1;
	}
	return { additions, removals };
}
