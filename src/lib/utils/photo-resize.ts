const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;

/**
 * Downscales a phone photo to a JPEG no larger than MAX_DIMENSION on its long
 * edge, so uploads stay small. Falls back to the original file when the
 * browser cannot decode it.
 */
export async function resizePhotoForUpload(file: File): Promise<Blob> {
	if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
		return file;
	}
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		return file;
	}
	try {
		const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext('2d');
		if (!context) return file;
		context.drawImage(bitmap, 0, 0, width, height);
		const blob = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
		);
		return blob ?? file;
	} finally {
		bitmap.close();
	}
}
