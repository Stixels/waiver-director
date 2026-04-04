import type { Attachment } from 'svelte/attachments';

export const scrollReveal: Attachment<Element> = (element) => {
	if (typeof IntersectionObserver === 'undefined') {
		element.classList.add('is-revealed');
		return;
	}

	const observer = new IntersectionObserver(
		([entry]) => {
			if (entry?.isIntersecting) {
				element.classList.add('is-revealed');
				observer.disconnect();
			}
		},
		{ rootMargin: '0px 0px -80px 0px', threshold: 0 }
	);

	observer.observe(element);

	return () => {
		observer.disconnect();
	};
};
