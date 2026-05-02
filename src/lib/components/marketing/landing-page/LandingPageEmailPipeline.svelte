<script lang="ts">
	import { CheckCircle2, Clock, PenLine, X } from '@lucide/svelte';

	import { scrollReveal } from '$lib/actions/scroll-reveal';

	const pipelineSteps = [
		{
			id: 'sign',
			icon: PenLine,
			label: 'Guest signs the waiver',
			detail: 'Each participant submits their own signature — not just the lead booker.',
			accent: true
		},
		{
			id: 'queue',
			icon: Clock,
			label: 'Send now or queue after a booking',
			detail: 'Send on demand, or let your configured booking delay start counting automatically.',
			accent: false
		},
		{
			id: 'send',
			icon: CheckCircle2,
			label: 'Email delivered from a verified sender',
			detail:
				'Verify your reply-to email to finish setup and send thank-yous, feedback requests, and review asks.',
			accent: false
		}
	] as const;
</script>

<section
	id="email-pipeline"
	class="border-t py-28 md:py-36"
	style="border-color: var(--m-border-soft);"
>
	<div class="mx-auto max-w-6xl px-4 sm:px-6">
		<div use:scrollReveal={{ delay: 0 }}>
			<p
				class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
				style="color: var(--primary);"
			>
				Email Automation
			</p>
			<h2
				class="mb-4 max-w-xl font-extrabold tracking-tight"
				style="font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(1.75rem, 3.5vw, 2.75rem); letter-spacing: -0.03em; line-height: 1.06;"
			>
				Every signer gets their own follow-up.
			</h2>
			<p class="mb-14 max-w-xl text-[15px] leading-relaxed" style="color: var(--m-text-2);">
				Not just the lead booker. Every guest who signs can receive an on-demand email or an
				individually timed follow-up after their booking. Verify your email to finish setup and
				start sending.
			</p>
		</div>

		<div class="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-16">
			<!-- Pipeline flow -->
			<div class="flex flex-col" use:scrollReveal={{ delay: 80 }}>
				{#each pipelineSteps as step, i (step.id)}
					{@const Icon = step.icon}
					<div class="flex gap-4">
						<div class="flex flex-col items-center">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
								style={step.accent
									? 'background: var(--m-accent-medium); border: 1px solid var(--m-accent-border);'
									: 'background: var(--m-elevated); border: 1px solid var(--m-border-strong);'}
							>
								<Icon
									size={17}
									style={step.accent ? 'color: var(--primary);' : 'color: var(--m-text-3);'}
								/>
							</div>
							{#if i < pipelineSteps.length - 1}
								<div
									class="my-1 w-px flex-1"
									style="min-height: 2.5rem; background: linear-gradient(to bottom, var(--m-border-strong), transparent);"
									aria-hidden="true"
								></div>
							{/if}
						</div>
						<div class="min-w-0 pb-8">
							<p class="mb-1.5 text-[15px] leading-snug font-semibold">
								{step.label}
							</p>
							<p class="text-[13px] leading-relaxed" style="color: var(--m-text-3);">
								{step.detail}
							</p>
						</div>
					</div>
				{/each}
			</div>

			<!-- Email preview card -->
			<div use:scrollReveal={{ delay: 140 }}>
				<div
					class="email-preview-card overflow-hidden rounded-xl border"
					style="background: var(--m-card); border-color: var(--m-border-strong); box-shadow: 0 16px 48px oklch(0 0 0 / 40%), inset 0 1px 0 oklch(1 0 0 / 5%);"
				>
					<!-- Chrome bar -->
					<div
						class="flex items-center justify-between border-b px-4 py-3"
						style="background: var(--m-elevated); border-color: var(--m-border-soft);"
					>
						<span class="text-[12px] font-semibold">Follow-up Preview</span>
						<div
							class="inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[10px] font-semibold"
							style="border-color: oklch(0.78 0.18 75 / 28%); background: oklch(0.78 0.18 75 / 8%); color: var(--m-amber);"
						>
							<span
								class="size-1.5 rounded-full"
								style="background: var(--m-amber);"
								aria-hidden="true"
							></span>
							Sending in 2 days
						</div>
					</div>

					<div class="px-5 py-4">
						<!-- Email meta -->
						<div
							class="mb-4 flex flex-col gap-1.5 border-b pb-4"
							style="border-color: var(--m-border-soft);"
						>
							{#each [['To', 'sarah.k@example.com'], ['From', 'hello@apexzipline.com'], ['Subj', 'Thanks for visiting Apex Zipline, Sarah!']] as [label, value] (label)}
								<div class="flex items-baseline gap-3">
									<span
										class="w-8 shrink-0 text-[10px] font-semibold tracking-wide uppercase"
										style="color: var(--m-text-3);"
									>
										{label}
									</span>
									<span class={['text-[13px]', label === 'Subj' ? 'font-semibold' : '']}
										>{value}</span
									>
								</div>
							{/each}
						</div>

						<!-- Body -->
						<div class="mb-4 flex flex-col gap-3 text-[13px] leading-relaxed">
							<p>Hi Sarah,</p>
							<p style="color: var(--m-text-2);">
								We hope you had an incredible time on the Wilderness Zipline Tour. It was great
								having your group with us!
							</p>
							<p style="color: var(--m-text-2);">
								If you have a spare moment, we&apos;d love to hear how your experience went.
							</p>
							<span
								class="inline-flex w-fit items-center gap-2 rounded-lg px-4 py-2 text-[12px] font-semibold"
								style="background: var(--m-accent-medium); color: var(--primary); border: 1px solid var(--m-accent-border);"
								aria-hidden="true"
							>
								Leave a quick review →
							</span>
						</div>

						<!-- Footer -->
						<div
							class="flex items-center justify-between border-t pt-3"
							style="border-color: var(--m-border-soft);"
						>
							<span class="text-[11px]" style="color: var(--m-text-3);">
								Post-visit feedback · 2 days after signing
							</span>
							<button
								class="flex items-center gap-1 rounded-md px-2 py-1 text-[11px]"
								style="color: var(--m-text-3); background: var(--m-elevated);"
								aria-label="Cancel this queued email"
								type="button"
							>
								<X size={11} aria-hidden="true" />
								Cancel
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	.email-preview-card {
		transition:
			box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1),
			transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@media (hover: hover) {
		.email-preview-card:hover {
			transform: translateY(-2px);
			box-shadow:
				0 24px 60px oklch(0 0 0 / 48%),
				0 0 48px oklch(0.52 0.22 277 / 8%),
				inset 0 1px 0 oklch(1 0 0 / 7%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.email-preview-card {
			transition: none !important;
		}
		.email-preview-card:hover {
			transform: none;
		}
	}
</style>
