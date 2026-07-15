<script lang="ts">
	import {
		getCompactMetricSegments,
		type GatewayMetrics
	} from '$lib/utils/gatewayCompletionMetadata';

	export let metrics: GatewayMetrics;
	export let locale: string | undefined = undefined;
	export let translate: (key: string) => string = (key) => key;

	$: segments = getCompactMetricSegments(metrics, locale);
</script>

{#if segments.length > 0}
	<div
		class="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5 text-[11px] leading-4 text-gray-500 dark:text-gray-400"
		dir="ltr"
		aria-label={segments
			.map((segment) => `${translate(segment.label)}: ${segment.value}`)
			.join(', ')}
	>
		{#each segments as segment, index (segment.key)}
			{#if index > 0}
				<span aria-hidden="true" class="text-gray-300 dark:text-gray-600">·</span>
			{/if}
			<span class="whitespace-nowrap" title={`${translate(segment.label)}: ${segment.value}`}>
				<span aria-hidden="true">{segment.symbol}</span>
				{segment.value}
			</span>
		{/each}
	</div>
{/if}
