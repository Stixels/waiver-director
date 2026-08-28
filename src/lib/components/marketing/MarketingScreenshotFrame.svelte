<script lang="ts">
	type Props = {
		src: string;
		alt: string;
		label: string;
		class?: string;
		priority?: boolean;
		compact?: boolean;
		/** Intrinsic pixel size of the source image. The defaults match the
		 *  workspace captures in `static/marketing`, which are all 1294x912.
		 *  These reserve the loading box, so a wrong ratio visibly distorts
		 *  the image until it decodes. */
		width?: number;
		height?: number;
		/** Show only a region of the source, given in source pixels. For captures
		 *  that carry large dead margins around the part worth reading. */
		crop?: { x: number; y: number; width: number; height: number };
	};

	let {
		src,
		alt,
		label,
		class: className = '',
		priority = false,
		compact = false,
		width = 1294,
		height = 912,
		crop
	}: Props = $props();

	// Percentages resolve against the viewport's width — including margin-top —
	// so the crop scales with the frame instead of needing fixed pixel offsets.
	const viewportStyle = $derived(crop ? `aspect-ratio: ${crop.width} / ${crop.height};` : '');
	const imageStyle = $derived(
		crop
			? `width: ${(width / crop.width) * 100}%;` +
					`margin-left: ${(-crop.x / crop.width) * 100}%;` +
					`margin-top: ${(-crop.y / crop.width) * 100}%;` +
					'max-width: none;'
			: ''
	);
</script>

<figure
	class={`marketing-shot group relative min-w-0 ${compact ? 'is-compact' : ''} ${className}`}
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
		<div class="marketing-shot__viewport overflow-hidden" style={viewportStyle}>
			<img
				{src}
				{alt}
				{width}
				{height}
				loading={priority ? 'eager' : 'lazy'}
				fetchpriority={priority ? 'high' : 'auto'}
				style={imageStyle}
				class="block h-auto w-full transition-transform duration-700 ease-out group-hover:scale-[1.018]"
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
		background: oklch(0.97 0.004 286);
	}

	.marketing-shot.is-compact .marketing-shot__viewport {
		aspect-ratio: 16 / 9;
	}

	.marketing-shot.is-compact img {
		height: 100%;
		object-fit: cover;
		object-position: top;
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
