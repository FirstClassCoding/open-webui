<script lang="ts">
	import { getContext } from 'svelte';

	import Dropdown from '$lib/components/common/Dropdown.svelte';
	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import Check from '$lib/components/icons/Check.svelte';
	import GlobeAlt from '$lib/components/icons/GlobeAlt.svelte';
	import {
		GATEWAY_SEARCH_MODES,
		normalizeGatewaySearchMode,
		type GatewaySearchMode
	} from '$lib/utils/gatewaySearchMode';

	const i18n = getContext('i18n');

	export let mode: GatewaySearchMode = 'off';
	export let onModeChange: (mode: GatewaySearchMode) => void = () => {};

	let show = false;

	const labels: Record<GatewaySearchMode, string> = {
		off: 'Off',
		on: 'On',
		auto: 'Auto'
	};

	const descriptions: Record<GatewaySearchMode, string> = {
		off: 'Do not search the web',
		on: 'Always search the web',
		auto: 'Let the Gateway decide'
	};

	const selectMode = (value: unknown) => {
		mode = normalizeGatewaySearchMode(value);
		onModeChange(mode);
		show = false;
	};
</script>

<Dropdown bind:show side="top" align="start">
	<Tooltip content={$i18n.t('Gateway Web Search')} placement="top">
		<button
			type="button"
			class="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-gray-600 transition hover:bg-gray-100 focus:outline-hidden dark:text-gray-300 dark:hover:bg-gray-800"
			aria-label={`${$i18n.t('Gateway Web Search')}: ${$i18n.t(labels[mode])}`}
		>
			<GlobeAlt className="size-4 shrink-0" strokeWidth="1.75" />
			<span class="whitespace-nowrap">{$i18n.t(labels[mode])}</span>
		</button>
	</Tooltip>

	<div slot="content">
		<div
			class="w-56 rounded-lg border border-gray-100 bg-white p-1 text-gray-900 shadow-lg dark:border-gray-800 dark:bg-gray-850 dark:text-white"
			aria-label={$i18n.t('Gateway Web Search')}
		>
			<div class="px-3 pb-1 pt-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
				{$i18n.t('Gateway Web Search')}
			</div>

			{#each GATEWAY_SEARCH_MODES as value}
				<button
					type="button"
					role="menuitemradio"
					aria-checked={mode === value}
					class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-hidden dark:hover:bg-gray-800/50 dark:focus:bg-gray-800/50"
					on:click={() => selectMode(value)}
				>
					<div class="flex min-w-0 flex-1 flex-col">
						<span class="text-sm">{$i18n.t(labels[value])}</span>
						<span class="truncate text-xs text-gray-500 dark:text-gray-400">
							{$i18n.t(descriptions[value])}
						</span>
					</div>

					<div class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400">
						{#if mode === value}
							<Check className="size-4" />
						{/if}
					</div>
				</button>
			{/each}
		</div>
	</div>
</Dropdown>
