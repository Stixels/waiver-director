/**
 * Website widget helpers shared by the settings page and the public waiver page.
 *
 * The widget script itself lives in `static/embed.js` (plain JS so it can be dropped
 * into any website). Keep the message shape below in sync with that file.
 */

export const EMBED_MESSAGE_SOURCE = 'waiver-director';

export type EmbedMessage =
	| { source: typeof EMBED_MESSAGE_SOURCE; type: 'resize'; height: number }
	| { source: typeof EMBED_MESSAGE_SOURCE; type: 'submitted' };

export type WidgetMode = 'button' | 'inline';

export const DEFAULT_WIDGET_LABEL = 'Sign waiver';
export const DEFAULT_WIDGET_COLOR = '#111827';
export const WIDGET_LABEL_MAX_LENGTH = 40;

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Returns a lowercase `#rrggbb`/`#rgb` color, or the default when the input is not a hex color. */
export function normalizeWidgetColor(value: string | null | undefined): string {
	const trimmed = (value ?? '').trim();
	return HEX_COLOR_PATTERN.test(trimmed) ? trimmed.toLowerCase() : DEFAULT_WIDGET_COLOR;
}

/** Collapses whitespace, trims, caps the length, and falls back to the default label. */
export function normalizeWidgetLabel(value: string | null | undefined): string {
	const collapsed = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, WIDGET_LABEL_MAX_LENGTH);
	return collapsed || DEFAULT_WIDGET_LABEL;
}

/** Picks black or white text for the best contrast against a hex background. */
export function widgetTextColor(background: string): '#ffffff' | '#111827' {
	let hex = normalizeWidgetColor(background).slice(1);
	if (hex.length === 3) {
		hex = hex
			.split('')
			.map((char) => char + char)
			.join('');
	}
	const channel = (offset: number) => {
		const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
		return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	};
	const luminance = 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
	return luminance > 0.4 ? '#111827' : '#ffffff';
}

function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export type WidgetSnippetOptions = {
	/** Absolute URL of `embed.js` on the app origin. */
	scriptUrl: string;
	/** Absolute URL of the workspace's public waiver page. */
	waiverUrl: string;
	mode: WidgetMode;
	label?: string;
	color?: string;
};

/** Builds the `<script>` snippet a business pastes into their website. */
export function buildWidgetSnippet(options: WidgetSnippetOptions): string {
	const attributes: Array<[string, string]> = [
		['src', options.scriptUrl],
		['data-waiver-url', options.waiverUrl],
		['data-mode', options.mode]
	];

	if (options.mode === 'button') {
		attributes.push(['data-label', normalizeWidgetLabel(options.label)]);
		attributes.push(['data-color', normalizeWidgetColor(options.color)]);
	}

	const rendered = attributes
		.map(([name, value]) => `\t${name}="${escapeAttribute(value)}"`)
		.join('\n');

	return `<script\n${rendered}\n\tasync\n></script>`;
}

/** Builds a plain iframe snippet for site builders that strip `<script>` tags. */
export function buildIframeSnippet(waiverUrl: string): string {
	const url = new URL(waiverUrl);
	url.searchParams.set('embed', '1');
	return `<iframe src="${escapeAttribute(url.toString())}" title="Waiver form" width="100%" height="920" style="border:0;border-radius:16px;overflow:hidden"></iframe>`;
}

/** Type guard for messages posted by an embedded waiver page. */
export function isEmbedMessage(value: unknown): value is EmbedMessage {
	if (!value || typeof value !== 'object') return false;
	const message = value as Record<string, unknown>;
	if (message.source !== EMBED_MESSAGE_SOURCE) return false;
	if (message.type === 'submitted') return true;
	return (
		message.type === 'resize' &&
		typeof message.height === 'number' &&
		Number.isFinite(message.height)
	);
}
