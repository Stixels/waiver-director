<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { authSecondaryButtonClass } from './auth-form-classes';

	let { disabled = false, onclick }: { disabled?: boolean; onclick: () => void } = $props();
</script>

<Button
	type="button"
	variant="outline"
	class={`${authSecondaryButtonClass} cursor-pointer`}
	{disabled}
	{onclick}
>
	<svg viewBox="0 0 24 24" aria-hidden="true" class="h-5 w-5">
		<path
			fill="#4285F4"
			d="M21.6 12.227c0-.818-.073-1.604-.209-2.364H12v4.473h5.382a4.602 4.602 0 0 1-1.995 3.018v2.507h3.236c1.894-1.744 2.977-4.314 2.977-7.634Z"
		/>
		<path
			fill="#34A853"
			d="M12 22c2.7 0 4.964-.895 6.618-2.427l-3.236-2.507c-.895.6-2.041.954-3.382.954-2.597 0-4.796-1.754-5.582-4.11H3.073v2.586A9.997 9.997 0 0 0 12 22Z"
		/>
		<path
			fill="#FBBC04"
			d="M6.418 13.91A5.997 5.997 0 0 1 6.105 12c0-.663.114-1.304.313-1.91V7.504H3.073A9.997 9.997 0 0 0 2 12c0 1.61.386 3.135 1.073 4.496l3.345-2.586Z"
		/>
		<path
			fill="#EA4335"
			d="M12 5.98c1.468 0 2.786.505 3.823 1.496l2.868-2.868C16.959 2.997 14.695 2 12 2A9.997 9.997 0 0 0 3.073 7.504L6.418 10.09C7.204 7.734 9.403 5.98 12 5.98Z"
		/>
	</svg>
	Continue with Google
</Button>
