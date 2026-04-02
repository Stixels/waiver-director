<script lang="ts">
	import { resolve } from '$app/paths';
	import { ChevronRight } from '@lucide/svelte';

	const footerLinks: Record<string, string[]> = {
		Product: ['Features', 'How it Works', 'Pricing', 'Changelog'],
		Integrations: ['Bookeo', 'Resova', 'Xola', 'API Docs'],
		Company: ['About', 'Blog', 'Privacy Policy', 'Terms of Service']
	};
</script>

<footer class="border-t py-12 px-6" style="background: var(--m-surface); border-color: var(--m-border);">
	<div class="mx-auto max-w-6xl">
		<div class="mb-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<a href={resolve('/')} class="mb-3 flex items-center gap-2 no-underline">
					<div
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
						style="background: var(--m-accent); color: var(--m-accent-fg); font-family: 'Bricolage Grotesque', sans-serif;"
						aria-hidden="true"
					>
						WD
					</div>
					<span
						class="text-[15px] font-bold"
						style="font-family: 'Bricolage Grotesque', sans-serif; color: var(--m-text);"
						>Waiver Director</span
					>
				</a>
				<p class="text-[13px]" style="color: var(--m-text-3);">
					Digital waivers for any booking experience.
				</p>
			</div>

			{#each Object.entries(footerLinks) as [category, links] (category)}
				<div>
					<p
						class="mb-3 text-[11px] font-semibold uppercase tracking-widest"
						style="color: var(--m-text-3);"
					>
						{category}
					</p>
					<ul>
						{#each links as link (link)}
							<li>
								<a
									href={resolve('/')}
									class="mb-2 block text-[13px] no-underline transition-opacity hover:opacity-100"
									style="color: var(--m-text-2); opacity: 0.8;"
								>
									{link}
									<ChevronRight class="inline size-2.5 opacity-40" aria-hidden="true" />
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<div
			class="flex flex-wrap items-center justify-between gap-4 border-t pt-6"
			style="border-color: var(--m-border);"
		>
			<p class="text-[12px]" style="color: var(--m-text-3);">
				© 2026 Waiver Director. All rights reserved.
			</p>
			<p class="text-[12px]" style="color: var(--m-text-3);">Built for every booking experience.</p>
		</div>
	</div>
</footer>
