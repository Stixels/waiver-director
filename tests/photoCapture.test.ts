import assert from 'node:assert/strict';
import test from 'node:test';
import {
	PHOTO_UPLOAD_MAX_BYTES,
	clientAddressFromForwardedFor,
	photoCaptureSettings,
	photoUploadRequestError,
	photoSubmissionError,
	photoUploadMetadataError
} from '../src/convex/lib/photoCapture.ts';

test('photo capture defaults to off for existing workspaces', () => {
	assert.deepEqual(photoCaptureSettings({}), { participantPhoto: 'off', idPhoto: 'off' });
	assert.deepEqual(
		photoCaptureSettings({ participantPhotoCapture: 'required', idPhotoCapture: 'optional' }),
		{ participantPhoto: 'required', idPhoto: 'optional' }
	);
});

test('required photos must be supplied', () => {
	const settings = { participantPhoto: 'required', idPhoto: 'optional' } as const;
	assert.match(
		photoSubmissionError(settings, { participant: false, id: false }) ?? '',
		/participant photo is required/
	);
	assert.equal(photoSubmissionError(settings, { participant: true, id: false }), null);
	assert.equal(photoSubmissionError(settings, { participant: true, id: true }), null);
});

test('photos are rejected when that capture kind is off', () => {
	const settings = { participantPhoto: 'off', idPhoto: 'off' } as const;
	assert.equal(photoSubmissionError(settings, { participant: false, id: false }), null);
	assert.match(
		photoSubmissionError(settings, { participant: false, id: true }) ?? '',
		/does not accept a photo ID/
	);
});

test('upload metadata must be a small image', () => {
	assert.equal(photoUploadMetadataError({ contentType: 'image/jpeg', size: 1024 }), null);
	assert.match(photoUploadMetadataError(null) ?? '', /not found/);
	assert.match(
		photoUploadMetadataError({ contentType: 'application/pdf', size: 1024 }) ?? '',
		/JPEG, PNG, or WebP/
	);
	assert.match(photoUploadMetadataError({ contentType: 'image/png', size: 0 }) ?? '', /empty/);
	assert.match(
		photoUploadMetadataError({ contentType: 'image/webp', size: PHOTO_UPLOAD_MAX_BYTES + 1 }) ?? '',
		/5MB/
	);
});

test('upload requests are checked before the body is read', () => {
	assert.equal(photoUploadRequestError('image/jpeg', 1024), null);
	assert.equal(photoUploadRequestError('image/png; charset=binary', null), null);
	assert.match(photoUploadRequestError('text/html', 10) ?? '', /JPEG, PNG, or WebP/);
	assert.match(photoUploadRequestError(null, 10) ?? '', /JPEG, PNG, or WebP/);
	assert.match(photoUploadRequestError('image/webp', PHOTO_UPLOAD_MAX_BYTES + 1) ?? '', /5MB/);
	assert.match(photoUploadRequestError('image/webp', 0) ?? '', /empty/);
});

test('rate limiting uses the proxy-added client address', () => {
	assert.equal(clientAddressFromForwardedFor(null), null);
	assert.equal(clientAddressFromForwardedFor(''), null);
	assert.equal(clientAddressFromForwardedFor('203.0.113.7'), '203.0.113.7');
	// A caller can prepend fake entries; the last one is the proxy's.
	assert.equal(clientAddressFromForwardedFor('1.1.1.1, 203.0.113.7'), '203.0.113.7');
});
