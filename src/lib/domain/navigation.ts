import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
import CalendarCheckIcon from '@lucide/svelte/icons/calendar-check';
import ScrollTextIcon from '@lucide/svelte/icons/scroll-text';
import UsersRoundIcon from '@lucide/svelte/icons/users-round';
import LayersIcon from '@lucide/svelte/icons/layers';
import MailIcon from '@lucide/svelte/icons/mail';
import PlugZapIcon from '@lucide/svelte/icons/plug-zap';
import SlidersHorizontalIcon from '@lucide/svelte/icons/sliders-horizontal';

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
		label: 'Customers',
		href: '/app/[workspaceSlug]/customers',
		icon: UsersRoundIcon,
		description: 'Signer contacts and repeat-visit history.'
	},
	{
		label: 'Waiver',
		href: '/app/[workspaceSlug]/waiver',
		icon: LayersIcon,
		description: 'Edit, publish, and share the workspace waiver.'
	},
	{
		label: 'Emails',
		href: '/app/[workspaceSlug]/emails',
		icon: MailIcon,
		description: 'Follow-up queue, templates, and email editor.'
	}
] as const;

/**
 * Workspace configuration items shown separately from the main workflow nav.
 */
export const appConfigNavItems = [
	{
		label: 'Integrations',
		href: '/app/[workspaceSlug]/integrations',
		icon: PlugZapIcon,
		description: 'Booking providers and email service connections.'
	},
	{
		label: 'Settings',
		href: '/app/[workspaceSlug]/settings',
		icon: SlidersHorizontalIcon,
		description: 'Workspace identity, email, branding, and team.'
	}
] as const;

/**
 * Combined navigation list for contexts that need a flat list.
 * Prefer appMainNavItems + appConfigNavItems in the sidebar.
 */
export const appNavigation = [...appMainNavItems, ...appConfigNavItems];
