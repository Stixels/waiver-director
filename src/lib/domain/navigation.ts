import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
import FileSignatureIcon from '@lucide/svelte/icons/file-signature';
import CalendarRangeIcon from '@lucide/svelte/icons/calendar-range';
import MailIcon from '@lucide/svelte/icons/mail';
import PlugZapIcon from '@lucide/svelte/icons/plug-zap';

export const appNavigation = [
	{
		label: 'Dashboard',
		href: '/app',
		icon: LayoutDashboardIcon,
		description: 'Operational overview and launch readiness.'
	},
	{
		label: 'Campaigns',
		href: '/app/campaigns',
		icon: FileSignatureIcon,
		description: 'Publishable waiver packets and public links.'
	},
	{
		label: 'Sessions',
		href: '/app/sessions',
		icon: CalendarRangeIcon,
		description: 'Manual and provider-backed event groups.'
	},
	{
		label: 'Emails',
		href: '/app/emails',
		icon: MailIcon,
		description: 'Reminder rules, queues, and follow-up templates.'
	},
	{
		label: 'Integrations',
		href: '/app/integrations',
		icon: PlugZapIcon,
		description: 'Booking sources, outbound email, and contact sync.'
	}
] as const;
