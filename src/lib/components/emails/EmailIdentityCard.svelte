<script lang="ts">
	import { useConvexClient } from 'convex-svelte';
	import { toast } from 'svelte-sonner';
	import type { Id } from '$convex/_generated/dataModel';
	import { api } from '$convex/_generated/api';
	import { useProtectedQuery } from '$lib/components/auth/convex-auth.svelte';
	import { getConvexErrorMessage } from '$lib/utils/convex-errors';

	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { InputOTP, InputOTPGroup, InputOTPSlot } from '$lib/components/ui/input-otp';
	import { REGEXP_ONLY_DIGITS } from 'bits-ui';
	import MailCheckIcon from '@lucide/svelte/icons/mail-check';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import AtSignIcon from '@lucide/svelte/icons/at-sign';
	import ReplyIcon from '@lucide/svelte/icons/reply';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import ClockIcon from '@lucide/svelte/icons/clock';
	import CheckIcon from '@lucide/svelte/icons/check';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';

	interface Props {
		workspaceId: Id<'workspaces'>;
		workspaceName: string;
		subjectPreview?: string;
		snippetPreview?: string;
	}

	let {
		workspaceId,
		workspaceName,
		subjectPreview: subjectPreviewOverride,
		snippetPreview: snippetPreviewOverride
	}: Props = $props();

	const convex = useConvexClient();

	const senderSettingsQuery = useProtectedQuery(api.emails.getWorkspaceEmailSenderSettings, () => ({
		workspaceId
	}));
	const senderSettings = $derived(senderSettingsQuery.data);

	let replyToEmail = $state('');
	let verificationCode = $state('');
	let isSendingVerification = $state(false);
	let isConfirmingVerification = $state(false);
	let isCancellingVerification = $state(false);
	let loadedSenderSettingsWorkspaceId = $state<Id<'workspaces'> | null>(null);
	let editingReplyTo = $state(false);
	let nowMs = $state(Date.now());

	function normalizeEmailInput(value: string) {
		return value.trim().toLowerCase();
	}

	function resetState() {
		replyToEmail = '';
		verificationCode = '';
		loadedSenderSettingsWorkspaceId = null;
		editingReplyTo = false;
	}

	$effect(() => {
		if (loadedSenderSettingsWorkspaceId !== workspaceId) {
			resetState();
		}

		if (
			senderSettings?.workspaceId === workspaceId &&
			loadedSenderSettingsWorkspaceId !== workspaceId
		) {
			replyToEmail = senderSettings.pendingReplyToEmail ?? senderSettings.replyToEmail ?? '';
			verificationCode = '';
			loadedSenderSettingsWorkspaceId = workspaceId;
		}
	});

	const verifiedReplyToMatchesInput = $derived(
		Boolean(
			senderSettings?.replyToEmail &&
			normalizeEmailInput(replyToEmail) === normalizeEmailInput(senderSettings.replyToEmail)
		)
	);
	const workspaceCanSendEmail = $derived(
		Boolean(senderSettings?.canSendEmails && verifiedReplyToMatchesInput)
	);
	const replyToPendingVerification = $derived(
		Boolean(
			senderSettings?.pendingReplyToEmail &&
			normalizeEmailInput(replyToEmail) === normalizeEmailInput(senderSettings.pendingReplyToEmail)
		)
	);
	const senderStatusLabel = $derived.by(() => {
		if (!senderSettings?.platformFromEmail) return 'Sender not configured';
		if (workspaceCanSendEmail) return 'Ready to send';
		if (replyToPendingVerification) return 'Verification pending';
		return 'Reply-to required';
	});

	$effect(() => {
		if (!replyToPendingVerification) return;
		if (!senderSettings?.verificationCodeExpiresAt) return;
		const tick = () => (nowMs = Date.now());
		tick();
		const interval = setInterval(tick, 1000);
		return () => clearInterval(interval);
	});

	const codeExpiresInMs = $derived(
		senderSettings?.verificationCodeExpiresAt && replyToPendingVerification
			? Math.max(0, senderSettings.verificationCodeExpiresAt - nowMs)
			: 0
	);
	const codeExpired = $derived(replyToPendingVerification && codeExpiresInMs <= 0);
	const canRequestReplyToVerification = $derived(
		Boolean(
			senderSettings?.platformFromEmail &&
			replyToEmail.trim() &&
			!isSendingVerification &&
			!isConfirmingVerification &&
			!isCancellingVerification
		)
	);
	const canConfirmReplyToVerification = $derived(
		Boolean(
			senderSettings?.platformFromEmail &&
			verificationCode.trim() &&
			!isSendingVerification &&
			!isConfirmingVerification &&
			!isCancellingVerification &&
			replyToPendingVerification &&
			!codeExpired
		)
	);

	function formatCountdown(ms: number) {
		const totalSec = Math.max(0, Math.floor(ms / 1000));
		const m = Math.floor(totalSec / 60);
		const s = totalSec % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}

	const setupPhase = $derived.by<'verified' | 'verifying' | 'collecting'>(() => {
		if (workspaceCanSendEmail && !editingReplyTo) return 'verified';
		if (replyToPendingVerification) return 'verifying';
		return 'collecting';
	});

	const businessInitials = $derived.by(() => {
		const name = workspaceName.trim();
		if (!name) return 'WD';
		const words = name.split(/\s+/).filter(Boolean);
		if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
		return (words[0][0] + words[words.length - 1][0]).toUpperCase();
	});
	const fromDomain = $derived.by(() => {
		const email = senderSettings?.platformFromEmail ?? '';
		const at = email.indexOf('@');
		return at > 0 ? email.slice(at + 1) : 'waiverdirector.com';
	});
	const replyToPreviewValue = $derived.by(() => {
		if (workspaceCanSendEmail) return senderSettings?.replyToEmail ?? '';
		if (replyToPendingVerification) return senderSettings?.pendingReplyToEmail ?? '';
		const trimmed = replyToEmail.trim();
		return trimmed || '';
	});
	const subjectPreview = $derived(
		subjectPreviewOverride?.trim() || `Thanks for visiting, ${workspaceName || 'us'}!`
	);
	const snippetPreview = $derived(
		snippetPreviewOverride?.trim() ||
			`Hi Alex — thanks for stopping by ${workspaceName || 'our team'} today. We hope you had a great time…`
	);
	const previewTimestamp = $derived(
		new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(nowMs))
	);
	function timeAgoShort(ts: number) {
		const diff = Math.max(0, nowMs - ts);
		const day = 86400000;
		if (diff < 60000) return 'just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < day) return `${Math.floor(diff / 3600000)}h ago`;
		if (diff < day * 30) return `${Math.floor(diff / day)}d ago`;
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
			new Date(ts)
		);
	}

	async function requestReplyToVerification() {
		if (!canRequestReplyToVerification) return;
		isSendingVerification = true;
		try {
			await convex.action(api.emails.startReplyToVerification, {
				workspaceId,
				replyToEmail
			});
			verificationCode = '';
			toast.success('Verification code sent.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to send verification code.'));
		} finally {
			isSendingVerification = false;
		}
	}

	async function confirmReplyToEmail() {
		if (!canConfirmReplyToVerification) return;
		isConfirmingVerification = true;
		try {
			await convex.action(api.emails.confirmReplyToVerification, {
				workspaceId,
				code: verificationCode
			});
			verificationCode = '';
			toast.success('Reply-to email verified.');
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to verify reply-to email.'));
		} finally {
			isConfirmingVerification = false;
		}
	}

	async function cancelReplyToVerification() {
		if (isSendingVerification || isConfirmingVerification || isCancellingVerification) return;
		if (!senderSettings?.pendingReplyToEmail) return;
		isCancellingVerification = true;
		try {
			await convex.mutation(api.emails.cancelReplyToVerification, {
				workspaceId
			});
			verificationCode = '';
			editingReplyTo = false;
			replyToEmail = senderSettings?.replyToEmail ?? '';
			toast.success(
				senderSettings?.replyToEmail ? 'Email change cancelled.' : 'Verification cancelled.'
			);
		} catch (err) {
			toast.error(getConvexErrorMessage(err, 'Failed to cancel verification.'));
		} finally {
			isCancellingVerification = false;
		}
	}

	function cancelReplyToEdit() {
		editingReplyTo = false;
		verificationCode = '';
		replyToEmail = senderSettings?.replyToEmail ?? senderSettings?.pendingReplyToEmail ?? '';
	}

	function handleAutoVerify() {
		if (verificationCode.trim().length === 6 && canConfirmReplyToVerification) {
			void confirmReplyToEmail();
		}
	}
</script>

<div class="sender-identity">
	<div class="identity-status-row">
		<span
			class="identity-status"
			data-state={workspaceCanSendEmail
				? 'verified'
				: replyToPendingVerification
					? 'pending'
					: 'idle'}
		>
			<span class="status-dot"></span>
			{senderStatusLabel}
		</span>
	</div>

	<div class="inbox-frame">
		<div class="inbox-frame-tag">Inbox preview</div>

		<article class="inbox-card">
			<div class="inbox-avatar" aria-hidden="true">{businessInitials}</div>
			<div class="inbox-card-body">
				<div class="inbox-meta-row">
					<span class="inbox-from-name">{workspaceName}</span>
					<span class="inbox-from-pill">your business</span>
					<span class="inbox-time">{previewTimestamp}</span>
				</div>
				<div class="inbox-via">
					<span class="inbox-label">via</span>
					<span class="inbox-mono">{fromDomain}</span>
				</div>
				<div class="inbox-subject">{subjectPreview}</div>
				<div class="inbox-snippet">{snippetPreview}</div>
			</div>
		</article>

		<div class="inbox-perforation" aria-hidden="true"></div>

		<div class="inbox-replyto">
			<ReplyIcon class="size-3.5 shrink-0 opacity-70" />
			<span class="inbox-replyto-label">When customers hit reply, it goes to</span>
			<span class="inbox-replyto-value" data-state={workspaceCanSendEmail ? 'verified' : 'unset'}>
				{replyToPreviewValue || 'not set yet'}
				{#if workspaceCanSendEmail}
					<CheckIcon class="size-3" />
				{/if}
			</span>
		</div>
	</div>

	{#if setupPhase === 'verified'}
		<div class="verified-summary">
			<div class="verified-mark">
				<ShieldCheckIcon class="size-5" />
			</div>
			<div class="verified-text">
				<p class="verified-title">You're set up to send.</p>
				<p class="verified-desc">
					Replies to follow-ups arrive at
					<strong class="font-medium text-foreground">{senderSettings?.replyToEmail}</strong
					>{#if senderSettings?.replyToVerifiedAt}
						· verified {timeAgoShort(senderSettings.replyToVerifiedAt)}{/if}.
				</p>
			</div>
			<button
				type="button"
				class="verified-edit"
				onclick={() => {
					editingReplyTo = true;
					replyToEmail = senderSettings?.replyToEmail ?? '';
				}}
			>
				<PencilIcon class="size-3.5" />
				Change
			</button>
		</div>
	{:else}
		<ol class="setup-steps">
			<li class="setup-step" data-state={setupPhase === 'verifying' ? 'done' : 'active'}>
				<div class="step-rail">
					<div class="step-marker">
						{#if setupPhase === 'verifying'}
							<CheckIcon class="size-[14px]" />
						{:else}
							<span class="step-num">1</span>
						{/if}
					</div>
					<div class="step-line" data-active={setupPhase === 'verifying'}></div>
				</div>
				<div class="step-body">
					<div class="step-head-row">
						<h3 class="step-title">Add your reply-to inbox</h3>
						{#if editingReplyTo && senderSettings?.replyToEmail}
							<button type="button" class="step-cancel-edit" onclick={cancelReplyToEdit}>
								Cancel
							</button>
						{/if}
					</div>
					<p class="step-desc">
						When a customer hits "Reply" on your follow-up, their message lands here. Use the inbox
						you actually check.
					</p>
					<form
						class="step-form"
						onsubmit={(e) => {
							e.preventDefault();
							void requestReplyToVerification();
						}}
					>
						<div class="reply-to-field">
							<AtSignIcon class="reply-to-icon size-4" />
							<Input
								id="reply-to-email"
								type="email"
								autocomplete="email"
								bind:value={replyToEmail}
								placeholder="frontdesk@yourbusiness.com"
								class="reply-to-input"
							/>
						</div>
						<Button
							type="submit"
							variant={setupPhase === 'verifying' ? 'outline' : 'default'}
							disabled={isSendingVerification ||
								isConfirmingVerification ||
								isCancellingVerification ||
								!canRequestReplyToVerification}
							class="step-cta gap-2"
						>
							{#if isSendingVerification}
								<LoaderIcon class="size-4 animate-spin" />
								Sending
							{:else if setupPhase === 'verifying'}
								<MailCheckIcon class="size-4" />
								Resend code
							{:else}
								<SendHorizontalIcon class="size-4" />
								Send code
							{/if}
						</Button>
					</form>
					{#if !senderSettings?.platformFromEmail}
						<p class="step-warn">
							Sender domain isn't configured. Ask an admin to set
							<code>RESEND_FROM_EMAIL</code>.
						</p>
					{/if}
				</div>
			</li>

			<li class="setup-step" data-state={setupPhase === 'verifying' ? 'active' : 'locked'}>
				<div class="step-rail">
					<div class="step-marker">
						<span class="step-num">2</span>
					</div>
				</div>
				<div class="step-body">
					<div class="step-head-row">
						<h3 class="step-title">Confirm the code we just emailed</h3>
						{#if setupPhase === 'verifying' && codeExpiresInMs > 0}
							<span class="step-timer" data-warn={codeExpiresInMs < 60000 ? 'true' : 'false'}>
								<ClockIcon class="size-3" />
								expires in {formatCountdown(codeExpiresInMs)}
							</span>
						{:else if codeExpired}
							<span class="step-timer" data-warn="true">
								<ClockIcon class="size-3" />
								code expired
							</span>
						{/if}
					</div>

					{#if setupPhase === 'verifying'}
						<p class="step-desc">
							Sent to
							<strong class="font-medium text-foreground"
								>{senderSettings?.pendingReplyToEmail}</strong
							>. Open it, copy the 6-digit code, paste below.
						</p>

						<div class="otp-row">
							<InputOTP
								maxlength={6}
								inputId="reply-to-code"
								bind:value={verificationCode}
								pattern={REGEXP_ONLY_DIGITS}
								onComplete={handleAutoVerify}
								class="otp-input"
							>
								{#snippet children({ cells })}
									<InputOTPGroup class="otp-group">
										{#each cells as cell, i (i)}
											<InputOTPSlot {cell} class="otp-slot" />
										{/each}
									</InputOTPGroup>
								{/snippet}
							</InputOTP>
							<Button
								type="button"
								onclick={confirmReplyToEmail}
								disabled={isSendingVerification ||
									isConfirmingVerification ||
									isCancellingVerification ||
									verificationCode.trim().length !== 6 ||
									!canConfirmReplyToVerification}
								class="otp-verify gap-2"
							>
								{#if isConfirmingVerification}
									<LoaderIcon class="size-4 animate-spin" />
									Verifying
								{:else}
									<ShieldCheckIcon class="size-4" />
									Verify
								{/if}
							</Button>
							<Button
								type="button"
								variant="outline"
								onclick={cancelReplyToVerification}
								disabled={isSendingVerification ||
									isConfirmingVerification ||
									isCancellingVerification ||
									!senderSettings?.pendingReplyToEmail}
								class="otp-cancel gap-2"
							>
								{#if isCancellingVerification}
									<LoaderIcon class="size-4 animate-spin" />
									Cancelling
								{:else}
									Cancel change
								{/if}
							</Button>
						</div>

						<div class="otp-foot">
							{#if codeExpired}
								<span class="otp-foot-warn">Code expired — request a new one above.</span>
							{:else}
								<span>
									Can't find it? Check spam, or
									<button
										type="button"
										class="otp-foot-link"
										disabled={!canRequestReplyToVerification}
										onclick={requestReplyToVerification}
									>
										resend the code
									</button>
									.
								</span>
							{/if}
						</div>
					{:else}
						<p class="step-desc step-desc-locked">
							After you send the code, paste the 6 digits here to finish.
						</p>
					{/if}
				</div>
			</li>
		</ol>
	{/if}
</div>

<style>
	.sender-identity {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.identity-status-row {
		display: flex;
		justify-content: flex-end;
	}

	.identity-status {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		padding: 0.32rem 0.7rem 0.32rem 0.55rem;
		border-radius: 9999px;
		font-size: 0.72rem;
		font-weight: 500;
		letter-spacing: 0.005em;
		border: 1px solid var(--border);
		background: color-mix(in srgb, var(--muted) 25%, transparent);
		color: var(--muted-foreground);
		flex-shrink: 0;
	}

	.identity-status .status-dot {
		width: 0.4rem;
		height: 0.4rem;
		border-radius: 9999px;
		background: currentColor;
		opacity: 0.7;
	}

	.identity-status[data-state='verified'] {
		color: oklch(0.64 0.16 152);
		border-color: color-mix(in srgb, oklch(0.65 0.18 152) 35%, var(--border));
		background: color-mix(in srgb, oklch(0.65 0.18 152) 10%, transparent);
	}

	.identity-status[data-state='pending'] {
		color: oklch(0.62 0.13 78);
		border-color: color-mix(in srgb, oklch(0.72 0.14 80) 35%, var(--border));
		background: color-mix(in srgb, oklch(0.72 0.14 80) 11%, transparent);
	}

	.identity-status[data-state='pending'] .status-dot {
		animation: identity-pulse 1.6s ease-in-out infinite;
	}

	@keyframes identity-pulse {
		0%,
		100% {
			opacity: 0.5;
			transform: scale(1);
		}
		50% {
			opacity: 1;
			transform: scale(1.4);
		}
	}

	.inbox-frame {
		position: relative;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border));
		background: color-mix(in srgb, var(--primary) 5%, var(--background));
		padding: 0.85rem;
		display: flex;
		flex-direction: column;
		gap: 0;
	}

	.inbox-frame-tag {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		width: fit-content;
		margin-bottom: 0.35rem;
		padding: 0;
		font-size: 0.62rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		font-weight: 600;
		color: color-mix(in srgb, var(--primary) 62%, var(--foreground));
	}

	.inbox-card {
		display: flex;
		gap: 0.85rem;
		padding: 0.4rem 0.4rem 0.6rem;
	}

	.inbox-avatar {
		flex-shrink: 0;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--primary) 78%, var(--foreground) 4%);
		border: 1px solid color-mix(in srgb, var(--primary) 35%, transparent);
		color: var(--primary-foreground);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.02em;
	}

	.inbox-card-body {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.18rem;
	}

	.inbox-meta-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.45rem;
		min-width: 0;
	}

	.inbox-from-name {
		font-size: 0.92rem;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--foreground);
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.inbox-from-pill {
		display: inline-flex;
		align-items: center;
		padding: 0.06rem 0.4rem;
		font-size: 0.6rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
		color: color-mix(in srgb, var(--primary) 72%, var(--foreground));
		background: color-mix(in srgb, var(--primary) 12%, transparent);
		border-radius: 9999px;
		border: 1px solid color-mix(in srgb, var(--primary) 24%, transparent);
	}

	.inbox-time {
		margin-left: auto;
		font-size: 0.7rem;
		color: var(--muted-foreground);
		font-variant-numeric: tabular-nums;
	}

	.inbox-via {
		display: flex;
		align-items: baseline;
		gap: 0.3rem;
		font-size: 0.7rem;
		color: var(--muted-foreground);
	}

	.inbox-label {
		opacity: 0.7;
	}

	.inbox-mono {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.68rem;
	}

	.inbox-subject {
		margin-top: 0.2rem;
		font-size: 0.86rem;
		font-weight: 500;
		color: var(--foreground);
		line-height: 1.35;
	}

	.inbox-snippet {
		font-size: 0.78rem;
		line-height: 1.45;
		color: var(--muted-foreground);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.inbox-perforation {
		height: 1px;
		margin: 0.4rem -0.85rem 0;
		border-top: 1px dashed color-mix(in srgb, var(--foreground) 15%, transparent);
	}

	.inbox-replyto {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		padding: 0.7rem 0.4rem 0.2rem;
		font-size: 0.74rem;
		color: var(--muted-foreground);
	}

	.inbox-replyto-label {
		opacity: 0.95;
	}

	.inbox-replyto-value {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.15rem 0.55rem;
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.72rem;
		font-weight: 500;
		color: var(--foreground);
		background: color-mix(in srgb, var(--muted) 60%, transparent);
		border: 1px solid var(--border);
		border-radius: 0.4rem;
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.inbox-replyto-value[data-state='unset'] {
		font-style: italic;
		color: var(--muted-foreground);
		background: transparent;
		border-style: dashed;
	}

	.inbox-replyto-value[data-state='verified'] {
		color: oklch(0.64 0.16 152);
		background: color-mix(in srgb, oklch(0.65 0.18 152) 10%, transparent);
		border-color: color-mix(in srgb, oklch(0.65 0.18 152) 32%, var(--border));
	}

	.verified-summary {
		display: flex;
		align-items: center;
		gap: 0.85rem;
		padding: 0.9rem 1rem;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, oklch(0.65 0.18 152) 28%, var(--border));
		background: color-mix(in srgb, oklch(0.65 0.18 152) 7%, transparent);
	}

	.verified-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, oklch(0.65 0.18 152) 15%, transparent);
		border: 1px solid color-mix(in srgb, oklch(0.65 0.18 152) 28%, var(--border));
		color: oklch(0.64 0.16 152);
		flex-shrink: 0;
	}

	.verified-text {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.verified-title {
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--foreground);
		letter-spacing: -0.005em;
	}

	.verified-desc {
		font-size: 0.76rem;
		color: var(--muted-foreground);
		line-height: 1.4;
	}

	.verified-edit {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.4rem 0.7rem;
		font-size: 0.74rem;
		font-weight: 500;
		color: var(--muted-foreground);
		background: color-mix(in srgb, var(--background) 80%, transparent);
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		flex-shrink: 0;
		cursor: pointer;
		transition: all 150ms ease;
	}

	.verified-edit:hover {
		color: var(--foreground);
		border-color: color-mix(in srgb, var(--foreground) 30%, var(--border));
		background: var(--background);
	}

	.setup-steps {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.setup-step {
		display: grid;
		grid-template-columns: 2rem 1fr;
		gap: 0.85rem;
		padding: 0.25rem 0;
		transition: opacity 200ms ease;
	}

	.setup-step[data-state='locked'] {
		opacity: 0.55;
	}

	.step-rail {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding-top: 0.25rem;
	}

	.step-marker {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 9999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.78rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground);
		background: var(--background);
		border: 1px dashed color-mix(in srgb, var(--foreground) 25%, transparent);
		transition: all 250ms ease;
	}

	.setup-step[data-state='active'] .step-marker {
		color: var(--primary-foreground);
		background: color-mix(in srgb, var(--primary) 88%, var(--foreground) 5%);
		border: 1px solid color-mix(in srgb, var(--primary) 88%, transparent);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
	}

	.setup-step[data-state='done'] .step-marker {
		color: oklch(0.99 0 0);
		background: oklch(0.58 0.16 152);
		border: 1px solid oklch(0.53 0.16 152);
	}

	.step-line {
		flex: 1;
		min-height: 1.5rem;
		width: 1px;
		border-left: 1px dashed color-mix(in srgb, var(--foreground) 18%, transparent);
	}

	.step-line[data-active='true'] {
		border-left-color: color-mix(in srgb, oklch(0.58 0.16 152) 80%, transparent);
	}

	@media (max-width: 520px) {
		.identity-status-row {
			justify-content: flex-start;
		}

		.inbox-frame {
			padding: 0.75rem;
		}

		.inbox-card {
			gap: 0.65rem;
			padding-inline: 0.2rem;
		}

		.inbox-avatar {
			width: 2.15rem;
			height: 2.15rem;
			font-size: 0.72rem;
		}

		.inbox-time {
			width: 100%;
			margin-left: 0;
		}

		.inbox-replyto {
			padding-inline: 0.2rem;
		}
	}

	.step-body {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		min-width: 0;
		padding-bottom: 0.5rem;
	}

	.step-head-row {
		display: flex;
		align-items: center;
		gap: 0.6rem;
		justify-content: space-between;
		flex-wrap: wrap;
	}

	.step-title {
		font-size: 0.92rem;
		font-weight: 600;
		letter-spacing: -0.005em;
		color: var(--foreground);
	}

	.step-cancel-edit {
		font-size: 0.7rem;
		color: var(--muted-foreground);
		background: transparent;
		border: none;
		padding: 0;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--muted-foreground) 50%, transparent);
		text-underline-offset: 3px;
	}

	.step-cancel-edit:hover {
		color: var(--foreground);
	}

	.step-desc {
		font-size: 0.78rem;
		line-height: 1.5;
		color: var(--muted-foreground);
	}

	.step-desc-locked {
		font-style: italic;
	}

	.step-warn {
		font-size: 0.72rem;
		color: var(--destructive);
	}

	.step-warn code {
		font-family: ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace;
		font-size: 0.7rem;
		padding: 0.05rem 0.35rem;
		background: color-mix(in srgb, var(--destructive) 12%, transparent);
		border-radius: 0.25rem;
	}

	.step-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.15rem;
	}

	@media (min-width: 540px) {
		.step-form {
			flex-direction: row;
			align-items: center;
		}
	}

	.reply-to-field {
		position: relative;
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
	}

	.reply-to-field :global(.reply-to-icon) {
		position: absolute;
		left: 0.7rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--muted-foreground);
		pointer-events: none;
		z-index: 1;
	}

	.reply-to-field :global(.reply-to-input) {
		padding-left: 2.1rem;
		width: 100%;
	}

	.step-form :global(.step-cta) {
		flex-shrink: 0;
	}

	.step-timer {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--muted-foreground);
		padding: 0.2rem 0.5rem;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--muted) 50%, transparent);
		border: 1px solid var(--border);
	}

	.step-timer[data-warn='true'] {
		color: oklch(0.7 0.18 28);
		background: color-mix(in srgb, oklch(0.7 0.18 28) 10%, transparent);
		border-color: color-mix(in srgb, oklch(0.7 0.18 28) 30%, transparent);
		animation: timer-warn 1.2s ease-in-out infinite;
	}

	@keyframes timer-warn {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}

	.otp-row {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		margin-top: 0.15rem;
	}

	@media (min-width: 540px) {
		.otp-row {
			flex-direction: row;
			align-items: center;
			flex-wrap: wrap;
		}
	}

	.otp-row :global(.otp-input) {
		display: inline-flex;
		max-width: 100%;
	}

	.otp-row :global(.otp-group) {
		gap: 0.4rem;
		max-width: 100%;
	}

	.otp-row :global(.otp-group .otp-slot),
	.otp-row :global(.otp-group [data-slot='input-otp-slot']) {
		width: 2.6rem;
		height: 2.85rem;
		font-size: 1.05rem;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		border-radius: 0.55rem !important;
		border: 1px solid var(--border) !important;
		background: var(--background);
		transition: all 150ms ease;
	}

	.otp-row :global(.otp-group [data-slot='input-otp-slot'][data-active='true']) {
		border-color: color-mix(in srgb, var(--primary) 60%, var(--border)) !important;
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent);
	}

	@media (max-width: 420px) {
		.otp-row :global(.otp-group) {
			gap: 0.25rem;
		}

		.otp-row :global(.otp-group .otp-slot),
		.otp-row :global(.otp-group [data-slot='input-otp-slot']) {
			width: 2.2rem;
			height: 2.55rem;
		}

		.otp-row :global(.otp-verify),
		.otp-row :global(.otp-cancel),
		.step-form :global(.step-cta) {
			width: 100%;
		}
	}

	.otp-row :global(.otp-verify) {
		flex-shrink: 0;
	}

	.otp-foot {
		font-size: 0.72rem;
		color: var(--muted-foreground);
		margin-top: 0.1rem;
	}

	.otp-foot-link {
		color: color-mix(in srgb, var(--primary) 60%, var(--foreground));
		background: transparent;
		border: none;
		padding: 0;
		font: inherit;
		font-weight: 500;
		cursor: pointer;
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--primary) 50%, transparent);
		text-underline-offset: 2px;
	}

	.otp-foot-link:hover:not(:disabled) {
		color: var(--primary);
		text-decoration-color: currentColor;
	}

	.otp-foot-link:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.otp-foot-warn {
		color: oklch(0.7 0.18 28);
		font-weight: 500;
	}
</style>
