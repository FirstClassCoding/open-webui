<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';

	import Tooltip from '$lib/components/common/Tooltip.svelte';
	import GlobeAlt from '$lib/components/icons/GlobeAlt.svelte';
	import Link from '$lib/components/icons/Link.svelte';
	import {
		formatDuration,
		formatIdentifier,
		getGatewaySearchStatusKey,
		getGatewaySearchStatusLabelKey,
		type GatewaySearchMetadata,
		type GatewaySearchStatusKey
	} from '$lib/utils/gatewayCompletionMetadata';

	const i18n = getContext<Writable<i18nType>>('i18n');

	export let search: GatewaySearchMetadata;

	const escapeHtml = (value: string) =>
		value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');

	const getModeLabel = (mode: string | undefined) => {
		if (mode === 'off') return $i18n.t('Off');
		if (mode === 'on') return $i18n.t('On');
		if (mode === 'auto') return $i18n.t('Auto');
		return formatIdentifier(mode) ?? $i18n.t('Unknown');
	};

	const getReasonLabel = (reason: string | undefined) => {
		const labels: Record<string, string> = {
			market_signal: 'Market/current-price question',
			general_knowledge: 'General knowledge; search skipped',
			requested_on: 'Search requested',
			requested_off: 'Search disabled',
			explicit_search_request: 'Explicit web search request',
			recency_signal: 'Current or recent information',
			auto_search_failed_fallback: 'Search failed; used direct model response'
		};
		return reason ? $i18n.t(labels[reason] ?? formatIdentifier(reason) ?? reason) : undefined;
	};

	const getToneClass = (status: GatewaySearchStatusKey) => {
		if (status === 'on' || status === 'auto_used') {
			return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
		}
		if (status === 'auto_fallback' || status.endsWith('no_results')) {
			return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
		}
		if (status === 'error') {
			return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';
		}
		return 'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300';
	};

	$: statusKey = getGatewaySearchStatusKey(search) ?? 'unknown';
	$: statusLabel = $i18n.t(getGatewaySearchStatusLabelKey(statusKey));
	$: sourceCount = search.sources.length;
	$: resultCount = search.resultCount ?? sourceCount;
	$: statusSummary = `${$i18n.t('Web Search')}: ${statusLabel}${
		resultCount > 0 && ['on', 'auto_used'].includes(statusKey)
			? ` · ${$i18n.t('{{COUNT}} sources', { COUNT: resultCount })}`
			: ''
	}`;
	$: detailRows = [
		[$i18n.t('Requested mode'), getModeLabel(search.requestedMode)],
		[$i18n.t('Resolved mode'), getModeLabel(search.resolvedMode)],
		[$i18n.t('Search status'), formatIdentifier(search.searchStatus)],
		[$i18n.t('Decision reason'), getReasonLabel(search.decisionReason)],
		[$i18n.t('Result count'), resultCount.toLocaleString($i18n.language)],
		[$i18n.t('Search time'), formatDuration(search.searchDurationMs)],
		[$i18n.t('Classifier'), search.classifier],
		[
			$i18n.t('Query'),
			search.query
				? `${search.query.slice(0, 180)}${search.query.length > 180 ? '…' : ''}`
				: undefined
		]
	].filter((row) => row[1] !== undefined && row[1] !== '');
	$: searchTooltip = `<div class="text-left space-y-1">${detailRows
		.map(
			([label, value]) =>
				`<div><span class="font-medium">${escapeHtml(String(label))}:</span> ${escapeHtml(String(value))}</div>`
		)
		.join('')}</div>`;
</script>

<div class="mt-2 flex w-full flex-wrap items-start gap-1.5 text-xs">
	<Tooltip content={searchTooltip} placement="bottom-start">
		<span
			class="inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-md border px-2 py-1 font-medium {getToneClass(
				statusKey
			)}"
			aria-label={statusSummary}
		>
			<GlobeAlt className="size-3.5 shrink-0" strokeWidth="2" />
			<span class="truncate">{statusSummary}</span>
		</span>
	</Tooltip>

	{#if sourceCount > 0}
		<details class="group w-full sm:w-auto">
			<summary
				class="inline-flex min-h-7 cursor-pointer list-none items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2 py-1 font-medium text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 [&::-webkit-details-marker]:hidden"
				aria-label={$i18n.t('Open {{COUNT}} sources', { COUNT: sourceCount })}
			>
				<Link className="size-3.5 shrink-0" strokeWidth="2" />
				<span>{$i18n.t('Sources')} · {sourceCount.toLocaleString($i18n.language)}</span>
			</summary>

			<div
				class="mt-1.5 w-full overflow-hidden rounded-md border border-gray-200 bg-white sm:min-w-80 sm:max-w-lg dark:border-gray-700 dark:bg-gray-900"
			>
				<ol class="max-h-80 overflow-y-auto px-3 py-1.5">
					{#each search.sources as source}
						<li class="border-b border-gray-100 py-2 last:border-b-0 dark:border-gray-800">
							{#if source.url}
								<a
									href={source.url}
									target="_blank"
									rel="noopener noreferrer"
									class="block rounded-sm outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500"
									aria-label={$i18n.t('Open source: {{TITLE}}', {
										TITLE: source.title ?? source.domain ?? $i18n.t('Untitled source')
									})}
								>
									<div class="flex min-w-0 items-start gap-2">
										<span class="shrink-0 font-mono text-gray-400">[{source.index}]</span>
										<span class="min-w-0">
											<span class="block break-words font-medium text-gray-800 dark:text-gray-100">
												{source.title ?? source.domain ?? $i18n.t('Untitled source')}
											</span>
											{#if source.domain || source.engine}
												<span
													class="mt-0.5 block break-words text-[11px] text-gray-500 dark:text-gray-400"
												>
													{[source.domain, source.engine].filter(Boolean).join(' · ')}
												</span>
											{/if}
										</span>
									</div>
								</a>
							{:else}
								<div class="flex min-w-0 items-start gap-2 text-gray-600 dark:text-gray-300">
									<span class="shrink-0 font-mono text-gray-400">[{source.index}]</span>
									<span class="min-w-0 break-words">
										{source.title ?? $i18n.t('Untitled source')}
										{#if source.engine}
											<span class="mt-0.5 block text-[11px] text-gray-500 dark:text-gray-400">
												{source.engine}
											</span>
										{/if}
									</span>
								</div>
							{/if}
						</li>
					{/each}
				</ol>
			</div>
		</details>
	{/if}
</div>
