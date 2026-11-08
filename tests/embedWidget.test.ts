import assert from 'node:assert/strict';
import test from 'node:test';
import {
	DEFAULT_WIDGET_COLOR,
	DEFAULT_WIDGET_LABEL,
	EMBED_MESSAGE_SOURCE,
	buildIframeSnippet,
	buildWidgetSnippet,
	isEmbedMessage,
	normalizeWidgetColor,
	normalizeWidgetLabel,
	widgetTextColor
} from '../src/lib/embed/widget.ts';

const scriptUrl = 'https://app.example.com/embed.js';
const waiverUrl = 'https://app.example.com/w/atlas-escape';

test('normalizes widget colors and labels', () => {
	assert.equal(normalizeWidgetColor('#2563EB'), '#2563eb');
	assert.equal(normalizeWidgetColor(' #abc '), '#abc');
	assert.equal(normalizeWidgetColor('red'), DEFAULT_WIDGET_COLOR);
	assert.equal(normalizeWidgetColor('#12345'), DEFAULT_WIDGET_COLOR);
	assert.equal(normalizeWidgetLabel('  Sign   your\nwaiver '), 'Sign your waiver');
	assert.equal(normalizeWidgetLabel('   '), DEFAULT_WIDGET_LABEL);
	assert.equal(normalizeWidgetLabel('x'.repeat(80)).length, 40);
});

test('picks readable text color for the button', () => {
	assert.equal(widgetTextColor('#111827'), '#ffffff');
	assert.equal(widgetTextColor('#ffffff'), '#111827');
	assert.equal(widgetTextColor('#ff0'), '#111827');
});

test('builds a button snippet with escaped attributes', () => {
	const snippet = buildWidgetSnippet({
		scriptUrl,
		waiverUrl,
		mode: 'button',
		label: 'Sign "now" <b>',
		color: '#2563EB'
	});
	assert.match(snippet, /src="https:\/\/app\.example\.com\/embed\.js"/);
	assert.match(snippet, /data-waiver-url="https:\/\/app\.example\.com\/w\/atlas-escape"/);
	assert.match(snippet, /data-mode="button"/);
	assert.match(snippet, /data-label="Sign &quot;now&quot; &lt;b&gt;"/);
	assert.match(snippet, /data-color="#2563eb"/);
	assert.ok(snippet.startsWith('<script'));
	assert.ok(snippet.endsWith('</script>'));
});

test('inline snippet omits button styling', () => {
	const snippet = buildWidgetSnippet({ scriptUrl, waiverUrl, mode: 'inline', label: 'Ignored' });
	assert.match(snippet, /data-mode="inline"/);
	assert.doesNotMatch(snippet, /data-label|data-color/);
});

test('iframe snippet points at the embed view', () => {
	assert.match(
		buildIframeSnippet(waiverUrl),
		/src="https:\/\/app\.example\.com\/w\/atlas-escape\?embed=1"/
	);
});

test('recognizes only well-formed embed messages', () => {
	assert.ok(isEmbedMessage({ source: EMBED_MESSAGE_SOURCE, type: 'resize', height: 1200 }));
	assert.ok(isEmbedMessage({ source: EMBED_MESSAGE_SOURCE, type: 'submitted' }));
	assert.ok(!isEmbedMessage({ source: EMBED_MESSAGE_SOURCE, type: 'resize', height: 'tall' }));
	assert.ok(!isEmbedMessage({ source: 'other', type: 'submitted' }));
	assert.ok(!isEmbedMessage(null));
});
