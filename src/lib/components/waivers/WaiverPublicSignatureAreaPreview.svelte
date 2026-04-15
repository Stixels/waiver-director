<script lang="ts">
	import { Button } from '$lib/components/ui/button';
</script>

<!-- Mirrors `SignaturePad` chrome (bordered canvas host + hint row) for non-interactive preview. -->
<div class="space-y-3">
	<div class="overflow-hidden rounded-2xl border border-border bg-white">
		<div
			class="flex h-[180px] w-full touch-none items-center justify-center bg-white"
			aria-hidden="true"
		>
			<span class="text-xs text-muted-foreground">Signature area</span>
		</div>
	</div>

	<div class="flex items-center justify-between gap-3">
		<p class="text-xs text-muted-foreground">Draw your signature with a mouse or touch.</p>
		<Button type="button" variant="outline" size="sm" disabled>Clear</Button>
	</div>
</div>
