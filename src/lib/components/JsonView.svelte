<script lang="ts">
	let { json }: { json: string } = $props();
</script>

<!-- A region that scrolls: focusable, so the keyboard can scroll it too (WCAG 2.1.1) -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<pre class="json" role="region" tabindex="0" aria-label="Results as JSON">{json}</pre>

<style>
	.json {
		box-sizing: border-box;
		max-height: 70vh;
		margin: 0;
		padding: 1rem;
		overflow: auto;
		font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
		font-size: 0.78rem;
		line-height: 1.5;
		color: #1a1a1a;
		background: #f7f7f7;
		border: 1px solid #e2e2e2;
		border-radius: 0.75rem;
	}
</style>
