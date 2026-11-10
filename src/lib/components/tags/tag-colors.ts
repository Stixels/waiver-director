import type { TagColor } from '$convex/lib/tags';

export type { TagColor };

const TAG_COLOR_CLASSES: Record<TagColor, string> = {
	gray: 'bg-muted text-muted-foreground border-border',
	red: 'bg-red-500/12 text-red-800 border-red-500/25 dark:text-red-300',
	orange: 'bg-orange-500/12 text-orange-800 border-orange-500/25 dark:text-orange-300',
	amber: 'bg-amber-500/15 text-amber-800 border-amber-500/25 dark:text-amber-300',
	green: 'bg-emerald-500/12 text-emerald-800 border-emerald-500/25 dark:text-emerald-300',
	teal: 'bg-teal-500/12 text-teal-800 border-teal-500/25 dark:text-teal-300',
	blue: 'bg-blue-500/12 text-blue-800 border-blue-500/25 dark:text-blue-300',
	violet: 'bg-violet-500/12 text-violet-800 border-violet-500/25 dark:text-violet-300',
	pink: 'bg-pink-500/12 text-pink-800 border-pink-500/25 dark:text-pink-300'
};

const TAG_DOT_CLASSES: Record<TagColor, string> = {
	gray: 'bg-muted-foreground/60',
	red: 'bg-red-500',
	orange: 'bg-orange-500',
	amber: 'bg-amber-500',
	green: 'bg-emerald-500',
	teal: 'bg-teal-500',
	blue: 'bg-blue-500',
	violet: 'bg-violet-500',
	pink: 'bg-pink-500'
};

export function tagColorClass(color: TagColor) {
	return TAG_COLOR_CLASSES[color] ?? TAG_COLOR_CLASSES.gray;
}

export function tagDotClass(color: TagColor) {
	return TAG_DOT_CLASSES[color] ?? TAG_DOT_CLASSES.gray;
}
