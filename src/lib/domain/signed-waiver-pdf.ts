import {
	PDFDocument,
	StandardFonts,
	rgb,
	type PDFFont,
	type PDFImage,
	type PDFPage
} from 'pdf-lib';

/**
 * Renders a signed waiver submission as a PDF. This module is shared by Convex
 * actions and Node tests, so it must stay free of runtime-specific imports.
 */

export type SignedWaiverPdfField =
	| { id: string; type: 'text'; label: string }
	| { id: string; type: 'checkbox'; label: string }
	| { id: string; type: 'select'; label: string; options: { id: string; label: string }[] }
	| { id: string; type: 'date'; label: string };

export type SignedWaiverPdfAnswer = string | boolean | null;

export type SignedWaiverPdfInput = {
	submissionId: string;
	workspaceName: string;
	waiverTitle: string;
	versionNumber: number | null;
	/** Waiver body as plain text, paragraphs separated by blank lines. */
	introText: string;
	fields: SignedWaiverPdfField[];
	answers: Record<string, SignedWaiverPdfAnswer>;
	signerName: string;
	signerEmail: string;
	signerDateOfBirth: string;
	minors: string[];
	booking: { providerBookingId: string; activityName: string; startTime: string | null } | null;
	marketingConsentLabel: string | null;
	marketingConsent: boolean;
	signatureDataUrl: string;
	submittedAt: number;
	/** SHA-256 fingerprint of the signed record, from `signedRecordFingerprint`. */
	fingerprint: string;
	generatedAt: number;
};

export type SignedRecordFingerprintInput = {
	submissionId: string;
	versionId: string;
	signerName: string;
	signerEmail: string;
	signerDateOfBirth: string;
	answers: Record<string, SignedWaiverPdfAnswer>;
	minors: string[];
	signatureDataUrl: string;
	submittedAt: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 56;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 64;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const SIGNATURE_MAX_WIDTH = 240;
const SIGNATURE_MAX_HEIGHT = 96;

const COLOR_TEXT = rgb(0.1, 0.1, 0.12);
const COLOR_MUTED = rgb(0.42, 0.43, 0.47);
const COLOR_RULE = rgb(0.86, 0.87, 0.89);

// Characters outside ASCII that the standard PDF fonts can encode (WinAnsi).
const WIN_ANSI_EXTRAS = new Set(
	'€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split('').map((char) => char.codePointAt(0) as number)
);

// Letters that do not decompose under NFKD but have an obvious ASCII stand-in.
const LETTER_FALLBACKS: Record<string, string> = {
	Ł: 'L',
	ł: 'l',
	Đ: 'D',
	đ: 'd',
	Ħ: 'H',
	ħ: 'h',
	ı: 'i',
	Ŀ: 'L',
	ŀ: 'l'
};

function isWinAnsiCodePoint(codePoint: number) {
	return (
		(codePoint >= 0x20 && codePoint <= 0x7e) ||
		(codePoint >= 0xa0 && codePoint <= 0xff) ||
		WIN_ANSI_EXTRAS.has(codePoint)
	);
}

/**
 * Maps text onto the WinAnsi character set used by the built-in PDF fonts.
 * Accented letters fall back to their base letter; anything else becomes "?".
 */
export function toPdfSafeText(value: string): string {
	let output = '';
	for (const char of value.replace(/\r\n?/g, '\n').replace(/\t/g, ' ')) {
		if (char === '\n') {
			output += char;
			continue;
		}
		const codePoint = char.codePointAt(0) as number;
		if (isWinAnsiCodePoint(codePoint)) {
			output += char;
			continue;
		}
		const fallback = LETTER_FALLBACKS[char];
		if (fallback) {
			output += fallback;
			continue;
		}
		const base = char.normalize('NFKD').replace(/[̀-ͯ]/g, '');
		output += [...base].every((part) => isWinAnsiCodePoint(part.codePointAt(0) as number))
			? base
			: '?';
	}
	return output;
}

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
	const lines: string[] = [];
	for (const paragraph of toPdfSafeText(text).split('\n')) {
		const words = paragraph.split(/ +/).filter(Boolean);
		if (words.length === 0) {
			lines.push('');
			continue;
		}

		let current = '';
		for (const word of words) {
			const candidate = current ? `${current} ${word}` : word;
			if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
				current = candidate;
				continue;
			}
			if (current) lines.push(current);

			// Break words that are wider than a full line (long emails, URLs).
			let remainder = word;
			while (font.widthOfTextAtSize(remainder, size) > maxWidth) {
				let cut = remainder.length - 1;
				while (cut > 1 && font.widthOfTextAtSize(remainder.slice(0, cut), size) > maxWidth) {
					cut -= 1;
				}
				lines.push(remainder.slice(0, cut));
				remainder = remainder.slice(cut);
			}
			current = remainder;
		}
		if (current) lines.push(current);
	}
	return lines;
}

export function formatSignedAnswer(
	field: SignedWaiverPdfField,
	answer: SignedWaiverPdfAnswer | undefined
): string {
	if (field.type === 'checkbox') {
		return answer === true ? 'Yes (checked)' : 'No (not checked)';
	}
	if (typeof answer !== 'string' || answer.trim().length === 0) {
		return 'No answer';
	}
	if (field.type === 'select') {
		return field.options.find((option) => option.id === answer)?.label ?? answer;
	}
	return answer.trim();
}

export function formatUtcTimestamp(timestamp: number): string {
	const iso = new Date(timestamp).toISOString();
	return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`;
}

function sortedRecord(record: Record<string, SignedWaiverPdfAnswer>) {
	return Object.fromEntries(
		Object.keys(record)
			.sort()
			.map((key) => [key, record[key] ?? null])
	);
}

/**
 * Stable SHA-256 over the immutable fields of a signed submission. Printing it
 * on the PDF lets anyone later confirm a copy matches the stored record.
 */
export async function signedRecordFingerprint(input: SignedRecordFingerprintInput) {
	const canonical = JSON.stringify({
		submissionId: input.submissionId,
		versionId: input.versionId,
		signerName: input.signerName,
		signerEmail: input.signerEmail,
		signerDateOfBirth: input.signerDateOfBirth,
		answers: sortedRecord(input.answers),
		minors: input.minors,
		signatureDataUrl: input.signatureDataUrl,
		submittedAt: input.submittedAt
	});
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function signedWaiverPdfFileName(args: { signerName: string; submittedAt: number }) {
	const slug =
		args.signerName
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60) || 'signer';
	return `signed-waiver-${slug}-${new Date(args.submittedAt).toISOString().slice(0, 10)}.pdf`;
}

function decodeBase64(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index += 1) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

async function embedSignature(pdf: PDFDocument, dataUrl: string): Promise<PDFImage | null> {
	const match = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
	if (!match) return null;
	try {
		const bytes = decodeBase64(match[2]);
		return match[1].toLowerCase() === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
	} catch {
		return null;
	}
}

class PdfCursor {
	readonly pdf: PDFDocument;
	readonly fonts: { regular: PDFFont; bold: PDFFont };
	page: PDFPage;
	y: number;

	constructor(pdf: PDFDocument, fonts: { regular: PDFFont; bold: PDFFont }) {
		this.pdf = pdf;
		this.fonts = fonts;
		this.page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
		this.y = PAGE_HEIGHT - MARGIN_TOP;
	}

	ensureSpace(height: number) {
		if (this.y - height >= MARGIN_BOTTOM) return;
		this.page = this.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
		this.y = PAGE_HEIGHT - MARGIN_TOP;
	}

	gap(height: number) {
		this.y -= height;
	}

	text(
		value: string,
		options: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {}
	) {
		const size = options.size ?? 10;
		const font = options.bold ? this.fonts.bold : this.fonts.regular;
		const indent = options.indent ?? 0;
		const lineHeight = size * 1.4;
		for (const line of wrapText(value, font, size, CONTENT_WIDTH - indent)) {
			this.ensureSpace(lineHeight);
			this.y -= lineHeight;
			if (line) {
				this.page.drawText(line, {
					x: MARGIN_X + indent,
					y: this.y + (lineHeight - size) / 2,
					size,
					font,
					color: options.color ?? COLOR_TEXT
				});
			}
		}
	}

	rule() {
		this.ensureSpace(12);
		this.y -= 6;
		this.page.drawLine({
			start: { x: MARGIN_X, y: this.y },
			end: { x: PAGE_WIDTH - MARGIN_X, y: this.y },
			thickness: 0.75,
			color: COLOR_RULE
		});
		this.y -= 6;
	}

	heading(value: string) {
		this.ensureSpace(48);
		this.gap(10);
		this.text(value.toUpperCase(), { size: 8.5, bold: true, color: COLOR_MUTED });
		this.rule();
	}

	labelValue(label: string, value: string) {
		this.ensureSpace(34);
		this.text(label, { size: 8.5, color: COLOR_MUTED });
		this.text(value, { size: 10.5 });
		this.gap(6);
	}

	image(image: PDFImage) {
		const scale = Math.min(
			SIGNATURE_MAX_WIDTH / image.width,
			SIGNATURE_MAX_HEIGHT / image.height,
			1
		);
		const width = image.width * scale;
		const height = image.height * scale;
		this.ensureSpace(height + 16);
		this.y -= height + 8;
		this.page.drawRectangle({
			x: MARGIN_X,
			y: this.y - 4,
			width: SIGNATURE_MAX_WIDTH + 16,
			height: height + 16,
			borderColor: COLOR_RULE,
			borderWidth: 0.75
		});
		this.page.drawImage(image, { x: MARGIN_X + 8, y: this.y + 4, width, height });
		this.y -= 12;
	}
}

export async function renderSignedWaiverPdf(input: SignedWaiverPdfInput): Promise<Uint8Array> {
	const pdf = await PDFDocument.create();
	const title = toPdfSafeText(input.waiverTitle || 'Signed waiver');
	pdf.setTitle(`${title} - ${toPdfSafeText(input.signerName)}`);
	pdf.setAuthor(toPdfSafeText(input.workspaceName));
	pdf.setSubject('Signed waiver');
	pdf.setProducer('Waiver Director');
	pdf.setCreator('Waiver Director');
	pdf.setCreationDate(new Date(input.generatedAt));
	pdf.setModificationDate(new Date(input.generatedAt));

	const fonts = {
		regular: await pdf.embedFont(StandardFonts.Helvetica),
		bold: await pdf.embedFont(StandardFonts.HelveticaBold)
	};
	const cursor = new PdfCursor(pdf, fonts);

	cursor.text(input.workspaceName, { size: 10, bold: true, color: COLOR_MUTED });
	cursor.gap(2);
	cursor.text(title, { size: 18, bold: true });
	cursor.gap(2);
	cursor.text(
		`Signed electronically by ${input.signerName} on ${formatUtcTimestamp(input.submittedAt)}` +
			(input.versionNumber !== null ? ` - waiver version ${input.versionNumber}` : ''),
		{ size: 9, color: COLOR_MUTED }
	);
	cursor.rule();

	if (input.introText.trim()) {
		cursor.text(input.introText.trim(), { size: 10 });
	}

	if (input.fields.length > 0) {
		cursor.heading('Responses');
		for (const field of input.fields) {
			cursor.labelValue(field.label, formatSignedAnswer(field, input.answers[field.id]));
		}
	}

	cursor.heading('Signer');
	cursor.labelValue('Full name', input.signerName);
	cursor.labelValue('Email', input.signerEmail);
	cursor.labelValue('Date of birth', input.signerDateOfBirth);
	if (input.minors.length > 0) {
		cursor.labelValue(
			input.minors.length === 1 ? 'Minor covered by this waiver' : 'Minors covered by this waiver',
			input.minors.join('\n')
		);
	}
	if (input.booking) {
		cursor.labelValue(
			'Booking',
			[
				`#${input.booking.providerBookingId}`,
				input.booking.activityName,
				input.booking.startTime ?? ''
			]
				.filter(Boolean)
				.join(' - ')
		);
	}
	if (input.marketingConsentLabel) {
		cursor.labelValue(
			'Marketing consent',
			`${input.marketingConsent ? 'Opted in' : 'Not opted in'}: ${input.marketingConsentLabel}`
		);
	}

	// Keep the signature heading, image, and printed name on the same page.
	cursor.ensureSpace(SIGNATURE_MAX_HEIGHT + 110);
	cursor.heading('Signature');
	const signature = await embedSignature(pdf, input.signatureDataUrl);
	if (signature) {
		cursor.image(signature);
	} else {
		cursor.text('Signature image could not be rendered.', { size: 10, color: COLOR_MUTED });
	}
	cursor.text(input.signerName, { size: 10.5, bold: true });
	cursor.text(`Signed ${formatUtcTimestamp(input.submittedAt)}`, { size: 9, color: COLOR_MUTED });

	cursor.heading('Signature record');
	cursor.labelValue('Submission ID', input.submissionId);
	cursor.labelValue('Signed record fingerprint (SHA-256)', input.fingerprint);
	cursor.labelValue('Copy generated', formatUtcTimestamp(input.generatedAt));
	cursor.text(
		'This copy was generated by Waiver Director from the stored signed record. The record itself cannot be edited after signing; the fingerprint above changes if any signed detail differs.',
		{ size: 8.5, color: COLOR_MUTED }
	);

	const pages = pdf.getPages();
	const footerLeft = toPdfSafeText(`${input.workspaceName} - ${title}`);
	pages.forEach((page, index) => {
		const right = `Page ${index + 1} of ${pages.length}`;
		const size = 8;
		let left = footerLeft;
		const maxLeftWidth = CONTENT_WIDTH - fonts.regular.widthOfTextAtSize(right, size) - 24;
		while (left.length > 1 && fonts.regular.widthOfTextAtSize(left, size) > maxLeftWidth) {
			left = `${left.slice(0, -2)}…`;
		}
		page.drawText(left, { x: MARGIN_X, y: 32, size, font: fonts.regular, color: COLOR_MUTED });
		page.drawText(right, {
			x: PAGE_WIDTH - MARGIN_X - fonts.regular.widthOfTextAtSize(right, size),
			y: 32,
			size,
			font: fonts.regular,
			color: COLOR_MUTED
		});
	});

	return await pdf.save();
}
