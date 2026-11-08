import assert from 'node:assert/strict';
import test from 'node:test';
import {
	PHOTO_UPLOAD_MAX_BYTES,
	photoCaptureSettings,
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
