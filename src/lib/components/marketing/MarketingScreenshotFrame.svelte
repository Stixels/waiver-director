<script lang="ts">
	type CropRect = { x: number; y: number; width: number; height: number };

	type Props = {
		src: string;
		alt: string;
		label: string;
		class?: string;
		priority?: boolean;
		/** Intrinsic pixel size of the source image. The defaults match the
		 *  workspace captures in `static/marketing`, which are all 1294x912.
		 *  These reserve the loading box, so a wrong ratio visibly distorts
		 *  the image until it decodes. */
		width?: number;
		height?: number;
		/** Show only a region of the source, given in source pixels. For captures
		 *  that carry large dead margins around the part worth reading. */
		crop?: CropRect;
		/** The region to show on phones. Falls back to `crop`. */
		mobileCrop?: CropRect;
	};

	let {
		src,
		alt,
		label,
		class: className = '',
		priority = false,
		width = 1294,
		height = 912,
		crop,
		mobileCrop
	}: Props = $props();

	// Percentages resolve against the viewport's width — including margin-top —
	// so the crop scales with the frame instead of needing fixed pixel offsets.
	function regionVars(region: CropRect | undefined, scope: string) {
		const r = region ?? { x: 0, y: 0, width, height };
		return (
			`--shot-${scope}-ratio: ${r.width} / ${r.height};` +
			`--shot-${scope}-width: ${(width / r.width) * 100}%;` +
			`--shot-${scope}-left: ${(-r.x / r.width) * 100}%;` +
			`--shot-${scope}-top: ${(-r.y / r.width) * 100}%;`
		);
	}

	const frameStyle = $derived(regionVars(crop, 'wide') + regionVars(mobileCrop ?? crop, 'narrow'));
</script>

<figure
	class={`marketing-shot group relative min-w-0 ${className}`}
	style={frameStyle}
	data-gsap-image
>
	<div class="marketing-shot__glow" aria-hidden="true"></div>
	<div class="marketing-shot__shell overflow-hidden rounded-2xl border">
		<div class="marketing-shot__bar flex h-10 items-center justify-between border-b px-4">
			<div class="flex items-center gap-1.5" aria-hidden="true">
				<span class="size-2 rounded-full bg-white/18"></span>
				<span class="size-2 rounded-full bg-white/12"></span>
				<span class="size-2 rounded-full bg-white/8"></span>
			</div>
			<span class="truncate text-[10px] font-semibold tracking-[0.12em] text-white/42 uppercase">
				{label}
			</span>
			<span class="size-2 rounded-full bg-emerald-400/80" aria-hidden="true"></span>
		</div>
		<div class="marketing-shot__viewport overflow-hidden">
			<img
				{src}
				{alt}
				{width}
				{height}
				loading={priority ? 'eager' : 'lazy'}
				fetchpriority={priority ? 'high' : 'auto'}
				class="block h-auto transition-transform duration-700 ease-out group-hover:scale-[1.018]"
			/>
		</div>
	</div>
</figure>

<style>
	.marketing-shot__glow {
		position: absolute;
		inset: 8% 10% -3%;
		background: oklch(0.52 0.22 277 / 18%);
		filter: blur(70px);
		pointer-events: none;
	}

	.marketing-shot__shell {
		position: relative;
		border-color: var(--m-border-strong);
		background: var(--m-surface);
		box-shadow:
			0 40px 100px oklch(0 0 0 / 62%),
			inset 0 1px 0 oklch(1 0 0 / 6%);
		transform: translateZ(0);
	}

	.marketing-shot__bar {
		border-color: var(--m-border-soft);
		background: oklch(0.105 0.008 286 / 96%);
	}

	.marketing-shot__viewport {
		aspect-ratio: var(--shot-wide-ratio);
		background: oklch(0.97 0.004 286);
	}

	.marketing-shot img {
		width: var(--shot-wide-width);
		margin-left: var(--shot-wide-left);
		margin-top: var(--shot-wide-top);
		max-width: none;
	}

	@media (max-width: 39.9375rem) {
		.marketing-shot__viewport {
			aspect-ratio: var(--shot-narrow-ratio);
		}

		.marketing-shot img {
			width: var(--shot-narrow-width);
			margin-left: var(--shot-narrow-left);
			margin-top: var(--shot-narrow-top);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.marketing-shot img {
			transition: none;
		}
		.marketing-shot:hover img {
			transform: none;
		}
	}
</style>
