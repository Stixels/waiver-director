import assert from 'node:assert/strict';
import test from 'node:test';
import {
	decodeHtml,
	normalizeRichTextSource,
	richTextHtmlToPlainText
} from '../src/lib/utils/rich-text-shared.ts';

test('normalizes entity-encoded rich text before sanitization', () => {
	const encoded = '&lt;p&gt;Read &lt;strong&gt;every term&lt;/strong&gt; before signing.&lt;/p&gt;';

	assert.equal(
		normalizeRichTextSource(encoded),
		'<p>Read <strong>every term</strong> before signing.</p>'
	);
});

test('leaves ordinary entity-encoded plain text on the plain-text path', () => {
	assert.equal(normalizeRichTextSource('Terms &amp; conditions'), 'Terms &amp; conditions');
});

test('removes actual and entity-encoded tags from email plain text', () => {
	const template =
		'&lt;p&gt;Hello {{customer_name}},&lt;/p&gt;&lt;p&gt;Your booking is &lt;strong&gt;confirmed&lt;/strong&gt;.&lt;br&gt;See you soon.&lt;/p&gt;';

	assert.equal(
		richTextHtmlToPlainText(template),
		'Hello {{customer_name}},\n\nYour booking is confirmed.\nSee you soon.'
	);
	assert.doesNotMatch(richTextHtmlToPlainText(template), /<\/?[a-z][^>]*>/i);
});

test('decodes numeric whitespace and named entities safely', () => {
	assert.equal(decodeHtml('Waiver&#x20;Director &amp; Co.&#32;'), 'Waiver Director & Co. ');
	assert.equal(decodeHtml('Invalid: &#99999999;'), 'Invalid: &#99999999;');
});
