<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		value?: string;
		disabled?: boolean;
		canvasId?: string;
		label?: string;
	}

	let {
		value = $bindable(''),
		disabled = false,
		canvasId = 'signature-pad',
		label = 'Signature pad'
	}: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let context = $state<CanvasRenderingContext2D | null>(null);
	let drawing = $state(false);
	let hasSignature = $state(false);
	// True once anything is on the canvas, even marks too small to count as a signature.
	let hasInk = $state(false);
	let activePointerId: number | null = null;
	let lastPoint: { x: number; y: number } | null = null;
	// Total length drawn since the pad was last empty, in CSS pixels.
	let inkLength = 0;
	let canvasSetupVersion = 0;
	let configuredWidth = 0;
	let configuredPixelRatio = 0;
	// The signature as it was when the last stroke finished, and the pad width it was drawn
	// at. Resizes always redraw from this original, never from an already-resized copy, so
	// repeated rotations cannot shrink or blur it further.
	let sourceImage = '';
	let sourceWidth = 0;

	const CANVAS_HEIGHT = 180;
	// A tap or a tiny wobble is not a signature; require a real stroke.
	const MIN_INK_LENGTH = 24;

	function configureContext(nextContext: CanvasRenderingContext2D, pixelRatio: number) {
		nextContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		nextContext.lineWidth = 2.25;
		nextContext.lineCap = 'round';
		nextContext.lineJoin = 'round';
		nextContext.strokeStyle = '#111827';
	}

	function loadSignatureImage(src: string): Promise<HTMLImageElement | null> {
		return new Promise((resolve) => {
			const image = new Image();
			image.onload = () => resolve(image);
			image.onerror = () => resolve(null);
			image.src = src;
		});
	}

	async function setupCanvas() {
		if (!canvas) return;

		const pixelRatio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		// Mobile browsers fire resize events when the URL bar shows/hides. Re-encoding the
		// canvas on every one of those would repeatedly resample (and blur) the signature,
		// so only rebuild the backing store when the drawable size actually changed.
		if (width === configuredWidth && pixelRatio === configuredPixelRatio) return;
		// Never reset the canvas mid-stroke; the next resize/settle will pick it up.
		if (drawing) return;

		const setupVersion = ++canvasSetupVersion;
		// A value supplied from outside (not drawn here) has no recorded width; treat it as
		// drawn at the current width.
		const preservedImage = sourceImage || value || '';
		const preservedWidth = sourceImage && sourceWidth > 0 ? sourceWidth : width;

		canvas.width = width * pixelRatio;
		canvas.height = CANVAS_HEIGHT * pixelRatio;
		configuredWidth = width;
		configuredPixelRatio = pixelRatio;
		const nextContext = canvas.getContext('2d');
		context = nextContext;

		if (!nextContext) return;

		configureContext(nextContext, pixelRatio);
		nextContext.clearRect(0, 0, width, CANVAS_HEIGHT);

		if (!preservedImage) {
			// Any marks too small to count were wiped with the canvas.
			resetInk();
			return;
		}

		const savedImage = await loadSignatureImage(preservedImage);
		if (!canvas || !context || setupVersion !== canvasSetupVersion) return;
		if (!savedImage) {
			hasSignature = value.length > 0;
			return;
		}

		// Redraw the original signature without distorting it: keep its aspect ratio and
		// only scale it down when the pad is narrower than the area it was drawn in.
		const scale = Math.min(1, width / preservedWidth);
		context.drawImage(savedImage, 0, 0, preservedWidth * scale, CANVAS_HEIGHT * scale);
		value = canvas.toDataURL('image/png') ?? '';
		hasSignature = value.length > 0;
		hasInk = hasSignature;
	}

	function resetInk() {
		hasSignature = false;
		hasInk = false;
		inkLength = 0;
		sourceImage = '';
		sourceWidth = 0;
	}

	function relativePoint(event: PointerEvent) {
		if (!canvas) return null;
		const rect = canvas.getBoundingClientRect();
		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	}

	function beginStroke(event: PointerEvent) {
		if (disabled || !context || !canvas) return;
		// Ignore secondary touches (e.g. a palm or second finger) and non-primary mouse buttons.
		if (!event.isPrimary || drawing) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;

		const point = relativePoint(event);
		if (!point) return;

		event.preventDefault();
		canvas.setPointerCapture(event.pointerId);
		activePointerId = event.pointerId;
		lastPoint = point;
		context.beginPath();
		context.moveTo(point.x, point.y);
		drawing = true;
	}

	function continueStroke(event: PointerEvent) {
		if (!drawing || disabled || !context) return;
		if (event.pointerId !== activePointerId) return;

		const point = relativePoint(event);
		if (!point) return;

		context.lineTo(point.x, point.y);
		context.stroke();
		if (lastPoint) {
			inkLength += Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
		}
		lastPoint = point;
		hasInk = true;
	}

	function endStroke(event: PointerEvent) {
		if (!canvas) return;
		if (!drawing || event.pointerId !== activePointerId) return;

		if (canvas.hasPointerCapture(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}
		// A tap or a tiny mark is not a signature; only capture once enough has been drawn.
		if (inkLength >= MIN_INK_LENGTH) {
			sourceImage = canvas.toDataURL('image/png') ?? '';
			sourceWidth = configuredWidth;
			value = sourceImage;
			hasSignature = value.length > 0;
		}
		drawing = false;
		activePointerId = null;
		lastPoint = null;
		// Pick up any resize that was skipped while the stroke was in progress.
		void setupCanvas();
	}

	function clearSignature() {
		if (!canvas || !context) return;
		// Cancel any redraw still waiting on an image decode.
		canvasSetupVersion += 1;
		context.clearRect(0, 0, canvas.clientWidth, CANVAS_HEIGHT);
		value = '';
		resetInk();
	}

	// The parent can clear the signature by resetting the bound value (for example when
	// the waiver text changes and the signer has to sign again).
	$effect(() => {
		if (value) return;
		untrack(() => {
			if (hasSignature) clearSignature();
		});
	});

	onMount(() => {
		const handleResize = () => {
			void setupCanvas();
		};

		void setupCanvas();
		window.addEventListener('resize', handleResize);

		let resizeObserver: ResizeObserver | null = null;
		if (canvas && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(handleResize);
			resizeObserver.observe(canvas);
		}

		return () => {
			window.removeEventListener('resize', handleResize);
			resizeObserver?.disconnect();
		};
	});
</script>

<div class="space-y-3">
	<div class="overflow-hidden rounded-2xl border border-border bg-white">
		<canvas
			id={canvasId}
			bind:this={canvas}
			aria-label={hasSignature ? `${label}: signature captured` : `${label}: no signature yet`}
			aria-describedby={`${canvasId}-hint`}
			class="block h-[180px] w-full cursor-crosshair touch-none select-none"
			onpointerdown={beginStroke}
			onpointermove={continueStroke}
			onpointerup={endStroke}
			onpointerleave={endStroke}
			onpointercancel={endStroke}
			oncontextmenu={(event) => event.preventDefault()}
		></canvas>
	</div>

	<div class="flex items-center justify-between gap-3">
		<p id={`${canvasId}-hint`} class="text-xs text-muted-foreground" aria-live="polite">
			{hasSignature
				? 'Signature captured.'
				: 'Draw your signature with a mouse, finger, or stylus.'}
		</p>
		<Button
			type="button"
			variant="outline"
			size="sm"
			onclick={clearSignature}
			disabled={disabled || !hasInk}
			aria-label="Clear signature"
		>
			Clear
		</Button>
	</div>
</div>
