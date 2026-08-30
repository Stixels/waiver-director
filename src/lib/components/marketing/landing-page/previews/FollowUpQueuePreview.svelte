<script lang="ts">
	import { Clock, Mail, MailCheck, Send } from '@lucide/svelte';

	const messages = [
		{
			icon: MailCheck,
			subject: 'Thanks for paddling with us',
			detail: 'Sent 6:12 PM · 14 recipients',
			state: 'Sent',
			tone: 'green'
		},
		{
			icon: Clock,
			subject: 'Photos from your tour',
			detail: '2 hours after booking',
			state: 'Queued',
			tone: 'accent'
		},
		{
			icon: Send,
			subject: 'Come back for the sunrise trip',
			detail: 'Friday 9:00 AM',
			state: 'Scheduled',
			tone: 'mute'
		},
		{
			icon: Mail,
			subject: 'Season pass offer',
			detail: 'Held · no marketing consent',
			state: 'Blocked',
			tone: 'amber'
		}
	] as const;
</script>

<div class="mkt-vig" data-gsap-image>
	<div class="mkt-vig__head">
		<span class="mkt-vig__title">Follow-up queue</span>
		<span class="mkt-pill mkt-pill--mute">Next 24h</span>
	</div>

	<div class="mkt-vig__body">
		<ul class="mkt-queue">
			{#each messages as message (message.subject)}
				{@const Icon = message.icon}
				<li>
					<span class="mkt-queue__ic"><Icon size={15} aria-hidden="true" /></span>
					<span>
						<span class="mkt-queue__t">{message.subject}</span>
						<span class="mkt-queue__sub">{message.detail}</span>
					</span>
					<span class="mkt-pill mkt-pill--{message.tone}"><i></i>{message.state}</span>
				</li>
			{/each}
		</ul>
	</div>
</div>
