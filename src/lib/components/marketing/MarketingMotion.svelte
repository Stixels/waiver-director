<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		let active = true;
		let cleanup = () => {};

		void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
			([{ default: gsap }, { ScrollTrigger }]) => {
				if (!active) return;

				gsap.registerPlugin(ScrollTrigger);
				const media = gsap.matchMedia();
				const context = gsap.context(() => {
					gsap.utils.toArray<HTMLElement>('[data-gsap-image]').forEach((element) => {
						gsap.fromTo(
							element,
							{ y: 26, opacity: 0.86 },
							{
								y: 0,
								opacity: 1,
								ease: 'none',
								scrollTrigger: {
									trigger: element,
									start: 'top 96%',
									end: 'top 68%',
									scrub: 0.7
								}
							}
						);
					});

					gsap.utils.toArray<HTMLElement>('[data-gsap-copy]').forEach((element) => {
						gsap.fromTo(
							element,
							{ y: 22, opacity: 0.18 },
							{
								y: 0,
								opacity: 1,
								ease: 'none',
								scrollTrigger: {
									trigger: element,
									start: 'top 90%',
									end: 'top 62%',
									scrub: 0.6
								}
							}
						);
					});

					media.add('(min-width: 1024px)', () => {
						gsap.utils.toArray<HTMLElement>('[data-gsap-pin]').forEach((element) => {
							const section = element.closest<HTMLElement>('[data-gsap-pin-section]');
							if (!section) return;

							ScrollTrigger.create({
								trigger: element,
								endTrigger: section,
								start: 'top 18%',
								end: () => {
									const pinnedTop = window.innerHeight * 0.18;
									const sectionBottom = section.getBoundingClientRect().bottom + window.scrollY;

									return Math.max(
										pinnedTop + 1,
										sectionBottom - (pinnedTop + element.offsetHeight + 48)
									);
								},
								pin: true,
								pinSpacing: false,
								invalidateOnRefresh: true
							});
						});
					});
				}, document.body);

				cleanup = () => {
					media.revert();
					context.revert();
				};

				ScrollTrigger.refresh();
			}
		);

		return () => {
			active = false;
			cleanup();
		};
	});
</script>
