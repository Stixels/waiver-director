<script lang="ts">
	import { onMount } from 'svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		value?: string;
		disabled?: boolean;
		canvasId?: string;
	}

	let { value = $bindable(''), disabled = false, canvasId = 'signature-pad' }: Props = $props();

	let canvas = $state<HTMLCanvasElement | null>(null);
	let context = $state<CanvasRenderingContext2D | null>(null);
	let drawing = $state(false);
	let hasSignature = $state(false);
	let canvasSetupVersion = 0;

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

		const setupVersion = ++canvasSetupVersion;
		const pixelRatio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		const preservedImage =
			hasSignature && canvas.width > 0 && canvas.height > 0
				? canvas.toDataURL('image/png')
				: value || '';

		canvas.width = width * pixelRatio;
		canvas.height = CANVAS_HEIGHT * pixelRatio;
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

		context.drawImage(savedImage, 0, 0, width, CANVAS_HEIGHT);
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

		const point = relativePoint(event);
		if (!point) return;

		canvas.setPointerCapture(event.pointerId);
		context.beginPath();
		context.moveTo(point.x, point.y);
		drawing = true;
	}

	function continueStroke(event: PointerEvent) {
		if (!drawing || disabled || !context) return;

		const point = relativePoint(event);
		if (!point) return;

		context.lineTo(point.x, point.y);
		context.stroke();
	}

	function endStroke(event: PointerEvent) {
		if (!canvas) return;
		if (drawing) {
			if (canvas.hasPointerCapture(event.pointerId)) {
				canvas.releasePointerCapture(event.pointerId);
			}
			value = canvas.toDataURL('image/png') ?? '';
			hasSignature = value.length > 0;
		}
		drawing = false;
	}

	function clearSignature() {
		if (!canvas || !context) return;
		context.clearRect(0, 0, canvas.clientWidth, CANVAS_HEIGHT);
		value = '';
		hasSignature = value.length > 0;
	}

	onMount(() => {
		const handleResize = () => {
			void setupCanvas();
		};

		void setupCanvas();
		window.addEventListener('resize', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
		};
	});
</script>

<div class="space-y-3">
	<div class="overflow-hidden rounded-2xl border border-border bg-white">
		<canvas
			id={canvasId}
			bind:this={canvas}
			class="block h-[180px] w-full touch-none"
			onpointerdown={beginStroke}
			onpointermove={continueStroke}
			onpointerup={endStroke}
			onpointerleave={endStroke}
			onpointercancel={endStroke}
		></canvas>
	</div>

	<div class="flex items-center justify-between gap-3">
		<p class="text-xs text-muted-foreground">
			{hasSignature ? 'Signature captured.' : 'Draw your signature with a mouse or touch.'}
		</p>
		<Button type="button" variant="outline" size="sm" onclick={clearSignature} {disabled}>
			Clear
		</Button>
	</div>
</div>
