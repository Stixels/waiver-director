<script lang="ts">
	import MarketingFaq from '$lib/components/marketing/MarketingFaq.svelte';

	const faqs = [
		{
			id: 'send-link',
			q: 'How do I send the waiver in a confirmation email or text?',
			a: 'Your workspace has a public waiver link you can paste into a confirmation email, a text message, or your own site. Each booking also gets its own link, so those signatures land on the right departure.'
		},
		{
			id: 'qr-code',
			q: 'How do I use a QR code to get people signed?',
			a: 'The general link and every booking link both render as a QR code. Print one for the counter or show it on screen, and the guest signs on their own phone — no app, no account.'
		},
		{
			id: 'unsigned-arrival',
			q: 'Someone turns up without a waiver. What do I do?',
			a: 'Show that booking’s QR code at the desk. They sign on their own phone, and the signed count moves while they are still standing there. If they never had a booking, your general waiver link covers walk-ins.'
		},
		{
			id: 'find-record',
			q: 'How do I find one person’s waiver months later?',
			a: 'Search across signers, their answers, bookings, and follow-ups. Repeat guests keep a visit history, so you can see every time somebody has signed.'
		},
		{
			id: 'marketing',
			q: 'Can I market to the people who fill out my waivers?',
			a: 'Only the ones who agreed to it. Signers who tick the consent box sync to your Mailchimp audience, and the exact sentence they were shown is stored on their record.'
		},
		{
			id: 'follow-ups',
			q: 'Can I send a thank-you or a review request afterwards?',
			a: 'Write the email once and schedule it from the booking time. Delivery stays visible, so you can see what sent, what is still queued, and what failed.'
		},
		{
			id: 'free',
			q: 'What can I do before I pay anything?',
			a: 'Build the whole waiver — wording, questions, branding — and preview the exact page a guest would see. Publishing it, and collecting real signatures, is where a paid plan starts.'
		}
	] as const;
</script>

<MarketingFaq {faqs} name="homepage-faq" />
