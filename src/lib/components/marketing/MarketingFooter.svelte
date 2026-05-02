<script lang="ts">
	import { resolve } from '$app/paths';

	type FooterEntry =
		| {
				label: string;
				href: '/#features' | '/#how-it-works' | '/#pricing' | '/features' | '/privacy' | '/terms';
		  }
		| { label: string; comingSoon: true };

	const currentYear = new Date().getFullYear();

	const footerColumns: { title: string; entries: readonly FooterEntry[] }[] = [
		{
			title: 'Product',
			entries: [
				{ label: 'Features', href: '/#features' },
				{ label: 'How it Works', href: '/#how-it-works' },
				{ label: 'Pricing', href: '/#pricing' },
				{ label: 'Changelog', comingSoon: true }
			] as const
		},
		{
			title: 'Integrations',
			entries: [
				{ label: 'Bookeo', href: '/features' },
				{ label: 'Resova', comingSoon: true },
				{ label: 'Xola', comingSoon: true },
				{ label: 'Mailchimp', comingSoon: true },
				{ label: 'Constant Contact', comingSoon: true },
				{ label: 'API docs', comingSoon: true }
			] as const
		},
		{
			title: 'Company',
			entries: [
				{ label: 'About', comingSoon: true },
				{ label: 'Blog', comingSoon: true },
				{ label: 'Privacy Policy', href: '/privacy' },
				{ label: 'Terms of Service', href: '/terms' }
			] as const
		}
	];
</script>

<footer
	class="relative border-t px-4 py-12 sm:px-6"
	style="background: var(--m-surface); border-color: var(--border);"
>
	<!-- Gradient accent line at top -->
	<div class="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden="true">
		<div
			class="h-px w-1/2 max-w-lg"
			style="background: linear-gradient(90deg, transparent, oklch(0.52 0.22 277 / 35%), transparent);"
		></div>
	</div>
	<div class="mx-auto max-w-6xl">
		<div class="mb-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
			<div>
				<a href={resolve('/')} class="mb-3 flex items-center gap-2 no-underline">
					<div
						class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
						style="background: var(--primary); color: var(--primary-foreground); font-family: 'Bricolage Grotesque', sans-serif;"
						aria-hidden="true"
					>
						WD
					</div>
					<span
						class="text-[15px] font-bold"
						style="font-family: 'Bricolage Grotesque', sans-serif;">Waiver Director</span
					>
				</a>
				<p class="text-[13px]" style="color: var(--m-text-3);">
					Digital waivers for any booking experience.
				</p>
			</div>

			{#each footerColumns as column (column.title)}
				<div>
					<p
						class="mb-3 text-[11px] font-semibold tracking-widest uppercase"
						style="color: var(--m-text-3);"
					>
						{column.title}
					</p>
					<ul>
						{#each column.entries as entry (entry.label)}
							<li>
								{#if 'comingSoon' in entry}
									<span class="mb-2 block text-[13px]" style="color: var(--m-text-3);">
										{entry.label}
										<span
											class="ml-1 text-[11px] font-normal"
											style="color: var(--m-text-3); opacity: 0.82;">(coming soon)</span
										>
									</span>
								{:else}
									<a
										href={resolve(entry.href)}
										class="mb-2 block text-[13px] no-underline transition-opacity hover:opacity-90"
										style="color: var(--m-text-3);"
									>
										{entry.label}
									</a>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>

		<div
			class="flex flex-wrap items-center justify-between gap-4 border-t pt-6"
			style="border-color: var(--border);"
		>
			<p class="text-[12px]" style="color: var(--m-text-3);">
				&copy; {currentYear} Waiver Director. All rights reserved.
			</p>
			<p class="text-[12px]" style="color: var(--m-text-3);">Built for every booking experience.</p>
		</div>
	</div>
</footer>
