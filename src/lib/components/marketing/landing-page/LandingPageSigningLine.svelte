<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowRight, MailCheck, QrCode, SquarePen, UsersRound } from '@lucide/svelte';

	import CoveragePreview from './previews/CoveragePreview.svelte';
	import FollowUpQueuePreview from './previews/FollowUpQueuePreview.svelte';
	import SharePreview from './previews/SharePreview.svelte';
	import WaiverBuilderPreview from './previews/WaiverBuilderPreview.svelte';

	const beats = [
		{
			icon: SquarePen,
			stage: 'Create your waiver',
			title: 'Build your waiver once.',
			description:
				"Create structured waivers with custom fields, required questions, signature blocks, and your branding. Publish a version and it's locked — past submissions are never altered when you make edits.",
			link: 'Inside the builder',
			href: '/features#waivers',
			preview: WaiverBuilderPreview
		},
		{
			icon: QrCode,
			stage: 'Display QR codes',
			title: 'Share your waiver anywhere.',
			description:
				'Use it as a link, embed it on your website, open it on a front-desk kiosk, or display a QR code. Create booking-specific QR codes for guests who still need to sign.',
			link: 'Where QR codes live',
			href: '/features#qr-codes',
			preview: SharePreview
		},
		{
			icon: UsersRound,
			stage: 'View your bookings',
			title: 'See every booking in one place.',
			description:
				'Bring bookings in from integrations such as Bookeo. See the activity, time, customer details, expected guest count, and how many waivers are signed, then share a booking link or QR code.',
			link: 'Booking coverage',
			href: '/features#operations',
			preview: CoveragePreview
		},
		{
			icon: MailCheck,
			stage: 'Follow-up emails',
			title: 'Automate customer follow-ups.',
			description:
				'Create reusable emails, send them now, or schedule them around the booking time. Track queued, sent, blocked, and failed messages, and sync customers who consent to Mailchimp.',
			link: 'Follow-ups and Mailchimp',
			href: '/features#follow-ups',
			preview: FollowUpQueuePreview
		}
	] as const;
</script>

<section class="signing-line" style="border-color: var(--m-border-soft);">
	<div class="wrap">
		<div class="signing-line__beats">
			{#each beats as beat (beat.stage)}
				{@const Icon = beat.icon}
				{@const Preview = beat.preview}
				<article class="beat">
					<div class="beat__body" data-gsap-copy>
						<span class="beat__node" aria-hidden="true"><Icon size={16} /></span>
						<p class="beat__stage">{beat.stage}</p>
						<h3 class="beat__title">{beat.title}</h3>
						<p class="beat__copy">{beat.description}</p>
						<p class="beat__more">
							<a href={resolve(beat.href)} class="beat__link">
								{beat.link}
								<ArrowRight size={15} aria-hidden="true" />
							</a>
						</p>
					</div>

					<div class="beat__aside">
						<Preview />
					</div>
				</article>
			{/each}
		</div>
	</div>
</section>

<style>
	.signing-line {
		padding-block: clamp(4.5rem, 8vw, 7.5rem);
		background:
			radial-gradient(circle at 72% 30%, oklch(0.42 0.18 277 / 9%), transparent 34rem), var(--m-bg);
	}

	.wrap {
		max-width: 78rem;
		margin-inline: auto;
		padding-inline: clamp(1.25rem, 4.2vw, 4rem);
	}

	.signing-line__beats {
		display: grid;
		gap: clamp(4rem, 7vw, 7rem);
	}

	/* The spine only appears once there is a gutter wide enough to hold it.
	   The gutter is sized so the copy starts one rhythm step from the icon
	   rather than across a wide empty channel: 3.5rem gutter - 2.5rem icon
	   leaves a 1rem gap, and the spine sits on the icon's centre at 1.25rem. */
	@media (min-width: 900px) {
		.signing-line__beats {
			position: relative;
			padding-left: 3.5rem;
		}

		.signing-line__beats::before {
			content: '';
			position: absolute;
			left: 1.25rem;
			top: 1rem;
			bottom: 2.5rem;
			width: 1px;
			background: linear-gradient(
				to bottom,
				transparent,
				var(--m-accent-line) 5%,
				var(--m-accent-line) 84%,
				transparent
			);
		}
	}

	.beat {
		position: relative;
		display: grid;
		gap: 1.9rem;
		min-width: 0;
	}

	@media (min-width: 1100px) {
		.beat {
			grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
			gap: clamp(2.5rem, 4.5vw, 4.5rem);
			align-items: center;
		}
	}

	.beat__node {
		display: none;
	}

	/* Anchored to the copy block rather than the article: the beat grid centres
	   its columns, so an icon pinned to the article would drift away from the
	   text whenever the preview beside it is the taller of the two. */
	.beat__body {
		position: relative;
	}

	@media (min-width: 900px) {
		.beat__node {
			display: grid;
			place-items: center;
			position: absolute;
			left: -3.5rem;
			top: -0.1rem;
			width: 2.5rem;
			height: 2.5rem;
			border-radius: 10px;
			border: 1px solid var(--m-accent-border-soft);
			background: oklch(0.1 0.02 286);
			color: var(--m-accent-text);
			box-shadow:
				0 0 0 7px var(--m-bg),
				0 10px 28px oklch(0 0 0 / 58%);
		}
	}

	.beat__stage {
		font-size: 0.7rem;
		font-weight: 700;
		letter-spacing: 0.11em;
		text-transform: uppercase;
		color: var(--m-text-3);
	}

	.beat__title {
		font-family: var(--m-font-display);
		font-size: clamp(1.6rem, 2.7vw, 2.35rem);
		font-weight: 600;
		letter-spacing: -0.043em;
		line-height: 1.07;
		margin-top: 0.85rem;
		max-width: 17ch;
	}

	.beat__copy {
		margin-top: 1rem;
		max-width: 44ch;
		color: var(--m-text-2);
		font-size: clamp(0.95rem, 1.15vw, 1.05rem);
		line-height: 1.72;
	}

	.beat__more {
		margin-top: 1.5rem;
	}

	.beat__link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--m-accent-text);
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: -0.012em;
		text-decoration: none;
		transition: gap 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	.beat__link:hover {
		gap: 0.72rem;
	}

	.beat__aside {
		min-width: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.beat__link {
			transition: none;
		}
	}
</style>
