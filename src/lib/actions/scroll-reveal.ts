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

	node.style.setProperty('--sr-delay', `${delay}ms`);
	node.classList.add('sr-hidden');

	const observer = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					node.classList.remove('sr-hidden');
					node.classList.add('sr-visible');
					observer.disconnect();
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
