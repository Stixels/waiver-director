<script lang="ts">
	import { onMount } from 'svelte';
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
	let activePointerId: number | null = null;
	let strokeHasInk = false;
	let canvasSetupVersion = 0;
	let configuredWidth = 0;
	let configuredPixelRatio = 0;

	const CANVAS_HEIGHT = 180;

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
		const previousWidth = configuredWidth;
		const preservedImage =
			hasSignature && canvas.width > 0 && canvas.height > 0
				? canvas.toDataURL('image/png')
				: value || '';

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
			hasSignature = false;
			return;
		}

		const savedImage = await loadSignatureImage(preservedImage);
		if (!canvas || !context || setupVersion !== canvasSetupVersion) return;
		if (!savedImage) {
			hasSignature = value.length > 0;
			return;
		}

		// Redraw the existing signature without distorting it: keep its aspect ratio and
		// only scale it down when the pad got narrower than the area it was drawn in.
		const sourceWidth = previousWidth > 0 ? previousWidth : width;
		const scale = Math.min(1, width / sourceWidth);
		context.drawImage(savedImage, 0, 0, sourceWidth * scale, CANVAS_HEIGHT * scale);
		value = canvas.toDataURL('image/png') ?? '';
		hasSignature = value.length > 0;
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
		strokeHasInk = false;
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
		strokeHasInk = true;
	}

	function endStroke(event: PointerEvent) {
		if (!canvas) return;
		if (!drawing || event.pointerId !== activePointerId) return;

		if (canvas.hasPointerCapture(event.pointerId)) {
			canvas.releasePointerCapture(event.pointerId);
		}
		// A tap with no movement leaves the canvas blank; don't treat it as a signature.
		if (strokeHasInk) {
			value = canvas.toDataURL('image/png') ?? '';
			hasSignature = value.length > 0;
		}
		drawing = false;
		activePointerId = null;
		strokeHasInk = false;
	}

	function clearSignature() {
		if (!canvas || !context) return;
		context.clearRect(0, 0, canvas.clientWidth, CANVAS_HEIGHT);
		value = '';
		hasSignature = false;
	}

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
			disabled={disabled || !hasSignature}
			aria-label="Clear signature"
		>
			Clear
		</Button>
	</div>
</div>
