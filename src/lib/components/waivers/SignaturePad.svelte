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

	const CANVAS_HEIGHT = 180;

	function setupCanvas() {
		if (!canvas) return;

		const pixelRatio = window.devicePixelRatio || 1;
		const width = canvas.clientWidth;
		canvas.width = width * pixelRatio;
		canvas.height = CANVAS_HEIGHT * pixelRatio;
		context = canvas.getContext('2d');

		if (!context) return;

		context.scale(pixelRatio, pixelRatio);
		context.lineWidth = 2.25;
		context.lineCap = 'round';
		context.lineJoin = 'round';
		context.strokeStyle = '#111827';
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
		value = canvas?.toDataURL('image/png') ?? '';
		hasSignature = value.length > 0;
	}

	function endStroke(event: PointerEvent) {
		if (!canvas) return;
		if (drawing) {
			canvas.releasePointerCapture(event.pointerId);
		}
		drawing = false;
	}

	function clearSignature() {
		if (!canvas || !context) return;
		context.clearRect(0, 0, canvas.width, canvas.height);
		value = '';
		hasSignature = value.length > 0;
	}

	onMount(() => {
		setupCanvas();
		window.addEventListener('resize', setupCanvas);

		return () => {
			window.removeEventListener('resize', setupCanvas);
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
