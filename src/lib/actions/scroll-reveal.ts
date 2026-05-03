import type { Action } from 'svelte/action';

interface ScrollRevealOptions {
	delay?: number;
	threshold?: number;
	once?: boolean;
}

export const scrollReveal: Action<HTMLElement, ScrollRevealOptions | undefined> = (
	node,
	options
) => {
	const delay = options?.delay ?? 0;
	const threshold = options?.threshold ?? 0.1;
	const once = options?.once ?? true;

	node.style.setProperty('--sr-delay', `${delay}ms`);
	node.classList.add('sr-hidden');

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					node.classList.remove('sr-hidden');
					node.classList.add('sr-visible');
					if (once) observer.disconnect();
				} else if (!once) {
					node.classList.remove('sr-visible');
					node.classList.add('sr-hidden');
				}
			});
		},
		{ threshold }
	);

	observer.observe(node);

	return {
		destroy() {
			observer.disconnect();
		}
	};
};
