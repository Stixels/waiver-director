import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';
import LayersIcon from '@lucide/svelte/icons/layers';
import MailIcon from '@lucide/svelte/icons/mail';
import PlugZapIcon from '@lucide/svelte/icons/plug-zap';

/**
 * Primary daily-workflow navigation items.
 */
export const appMainNavItems = [
	{
		label: 'Dashboard',
		href: '/app/[workspaceSlug]',
		icon: LayoutDashboardIcon,
		description: 'Operational overview and live waiver status.'
	},
	{
		label: 'Bookings',
		href: '/app/[workspaceSlug]/bookings',
		icon: CalendarCheckIcon,
		description: 'Provider-synced and manual session groups.'
	},
	{
		label: 'Submissions',
		href: '/app/[workspaceSlug]/submissions',
		icon: ScrollTextIcon,
		description: 'Signed waiver records and submission activity.'
	},
	{
		label: 'Waiver',
		href: '/app/[workspaceSlug]/waiver',
		icon: LayersIcon,
		description: 'Edit, publish, and share the workspace waiver.'
	},
	{
		label: 'Email follow-ups',
		href: '/app/[workspaceSlug]/emails',
		icon: MailIcon,
		description: 'Reminder rules, queues, and follow-up sequences.'
	}
] as const;

/**
 * Workspace configuration items — shown in a separate section below
 * main nav. Can be migrated to workspace settings in a future pass.
 */
export const appConfigNavItems = [
	{
		label: 'Integrations',
		href: '/app/[workspaceSlug]/integrations',
		icon: PlugZapIcon,
		description: 'Booking providers and email service connections.'
	}
] as const;

/**
 * Combined navigation list for contexts that need a flat list.
 * Prefer appMainNavItems + appConfigNavItems in the sidebar.
 */
export const appNavigation = [...appMainNavItems, ...appConfigNavItems];
