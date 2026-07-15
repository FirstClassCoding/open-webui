export type GatewaySource = {
	index: number;
	title?: string;
	url?: string;
	domain?: string;
	engine?: string;
};

export type GatewaySearchMetadata = {
	requestedMode?: string;
	resolvedMode?: string;
	webSearchUsed?: boolean;
	searchStatus?: string;
	decisionReason?: string;
	classifier?: string;
	query?: string;
	resultCount?: number;
	searchDurationMs?: number;
	sources: GatewaySource[];
};

export type GatewayMetrics = {
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
	responseTokensPerSecond?: number;
	promptTokensPerSecond?: number;
	totalDurationMs?: number;
	searchDurationMs?: number;
	llmDurationMs?: number;
};

export type CompactMetricSegment = {
	key: keyof GatewayMetrics;
	symbol: string;
	label: string;
	value: string;
	text: string;
};

export type ResponseMetricDetail = {
	key: keyof GatewayMetrics;
	label: string;
	value: string;
};

export type GatewaySearchStatusKey =
	| 'off'
	| 'on'
	| 'auto_used'
	| 'auto_skipped'
	| 'auto_fallback'
	| 'on_no_results'
	| 'auto_no_results'
	| 'error'
	| 'unknown';

type UnknownRecord = Record<string, unknown>;

const PROVIDER_METADATA_KEYS = [
	'provider',
	'response_token_s',
	'prompt_token_s',
	'prompt_eval_count',
	'eval_count',
	'total_duration'
] as const;

const SEARCH_METADATA_KEYS = [
	'requested_mode',
	'resolved_mode',
	'web_search_used',
	'search_status',
	'decision_reason',
	'classifier',
	'query',
	'search_result_count',
	'search_duration_ms'
] as const;

const METRICS_KEYS = ['total_duration_ms', 'llm_duration_ms', 'tokens_per_second'] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const copyKnownPrimitiveFields = (
	value: unknown,
	keys: readonly string[]
): UnknownRecord | undefined => {
	if (!isRecord(value)) return undefined;

	const result: UnknownRecord = {};
	for (const key of keys) {
		const field = value[key];
		if (['string', 'number', 'boolean'].includes(typeof field)) {
			result[key] = field;
		}
	}
	return Object.keys(result).length > 0 ? result : undefined;
};

const finiteNonNegativeNumber = (value: unknown): number | undefined => {
	let number: number;
	if (typeof value === 'number') {
		number = value;
	} else if (typeof value === 'string') {
		const text = value.trim();
		if (!/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return undefined;
		number = Number(text);
	} else {
		return undefined;
	}

	return Number.isFinite(number) && number >= 0 ? number : undefined;
};

const finiteNonNegativeInteger = (value: unknown): number | undefined => {
	const number = finiteNonNegativeNumber(value);
	return number === undefined ? undefined : Math.floor(number);
};

const nonEmptyString = (value: unknown, maxLength = 500): string | undefined => {
	if (typeof value !== 'string') return undefined;
	const text = value.trim();
	return text ? text.slice(0, maxLength) : undefined;
};

export const getSafeHttpUrl = (value: unknown): string | undefined => {
	const url = nonEmptyString(value, 2048);
	if (!url) return undefined;

	try {
		const parsed = new URL(url);
		return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined;
	} catch {
		return undefined;
	}
};

const getDomain = (url: string | undefined): string | undefined => {
	if (!url) return undefined;
	try {
		return new URL(url).hostname.replace(/^www\./i, '') || undefined;
	} catch {
		return undefined;
	}
};

const normalizeSourcesForStorage = (value: unknown): UnknownRecord[] => {
	if (!Array.isArray(value)) return [];

	return value.slice(0, 50).flatMap((item) => {
		const source = copyKnownPrimitiveFields(item, ['index', 'title', 'url', 'engine']);
		return source ? [source] : [];
	});
};

const normalizeGatewayMetadataForStorage = (value: unknown): UnknownRecord | undefined => {
	if (!isRecord(value)) return undefined;

	const normalized: UnknownRecord = {};
	const search = copyKnownPrimitiveFields(value.search, SEARCH_METADATA_KEYS);
	if (isRecord(value.search) && 'sources' in value.search) {
		const normalizedSources = normalizeSourcesForStorage(value.search.sources);
		if (search || normalizedSources.length > 0) {
			normalized.search = { ...(search ?? {}), sources: normalizedSources };
		}
	} else if (search) {
		normalized.search = search;
	}

	const metrics = copyKnownPrimitiveFields(value.metrics, METRICS_KEYS);
	if (metrics) normalized.metrics = metrics;

	return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const normalizeSourcesForView = (value: unknown): GatewaySource[] => {
	if (!Array.isArray(value)) return [];

	return value
		.slice(0, 50)
		.flatMap((item, position) => {
			if (!isRecord(item)) return [];
			const url = getSafeHttpUrl(item.url);
			return [
				{
					index: finiteNonNegativeInteger(item.index) || position + 1,
					title: nonEmptyString(item.title),
					url,
					domain: getDomain(url),
					engine: nonEmptyString(item.engine, 300)
				}
			];
		})
		.sort((a, b) => a.index - b.index);
};

const normalizeSearchForView = (value: unknown): GatewaySearchMetadata | undefined => {
	if (!isRecord(value)) return undefined;

	return {
		requestedMode: nonEmptyString(value.requested_mode, 20)?.toLowerCase(),
		resolvedMode: nonEmptyString(value.resolved_mode, 20)?.toLowerCase(),
		webSearchUsed: typeof value.web_search_used === 'boolean' ? value.web_search_used : undefined,
		searchStatus: nonEmptyString(value.search_status, 50)?.toLowerCase(),
		decisionReason: nonEmptyString(value.decision_reason, 100),
		classifier: nonEmptyString(value.classifier, 100),
		query: nonEmptyString(value.query, 500),
		resultCount: finiteNonNegativeInteger(value.search_result_count),
		searchDurationMs: finiteNonNegativeNumber(value.search_duration_ms),
		sources: normalizeSourcesForView(value.sources)
	};
};

const firstNumber = (...values: unknown[]): number | undefined => {
	for (const value of values) {
		const number = finiteNonNegativeNumber(value);
		if (number !== undefined) return number;
	}
	return undefined;
};

export const normalizeGatewayCompletionMetadata = (data: unknown) => {
	const response = isRecord(data) ? data : {};
	const usage = isRecord(response.usage) ? { ...response.usage } : undefined;
	const info = isRecord(response.info) ? response.info : {};
	const providerMetadata = copyKnownPrimitiveFields(
		response.metadata ?? response.provider_metadata,
		PROVIDER_METADATA_KEYS
	);
	const gatewayMetadata = normalizeGatewayMetadataForStorage(response.gateway_metadata);
	const searchRaw = isRecord(gatewayMetadata?.search) ? gatewayMetadata.search : undefined;
	const metricsRaw = isRecord(gatewayMetadata?.metrics) ? gatewayMetadata.metrics : {};
	const search = normalizeSearchForView(searchRaw);

	const promptTokens = firstNumber(
		usage?.prompt_tokens,
		usage?.input_tokens,
		providerMetadata?.prompt_eval_count,
		info.prompt_eval_count
	);
	const completionTokens = firstNumber(
		usage?.completion_tokens,
		usage?.output_tokens,
		providerMetadata?.eval_count,
		info.eval_count
	);
	const totalTokens =
		firstNumber(usage?.total_tokens) ??
		(promptTokens !== undefined || completionTokens !== undefined
			? (promptTokens ?? 0) + (completionTokens ?? 0)
			: undefined);
	const totalDurationNs = firstNumber(
		usage?.total_duration,
		providerMetadata?.total_duration,
		info.total_duration
	);

	const metrics: GatewayMetrics = {
		promptTokens,
		completionTokens,
		totalTokens,
		responseTokensPerSecond: firstNumber(
			usage?.['response_token/s'],
			providerMetadata?.response_token_s,
			metricsRaw.tokens_per_second
		),
		promptTokensPerSecond: firstNumber(usage?.['prompt_token/s'], providerMetadata?.prompt_token_s),
		totalDurationMs:
			firstNumber(metricsRaw.total_duration_ms) ??
			(totalDurationNs !== undefined ? totalDurationNs / 1_000_000 : undefined),
		searchDurationMs: search?.searchDurationMs,
		llmDurationMs: firstNumber(metricsRaw.llm_duration_ms)
	};

	return {
		usage,
		providerMetadata,
		gatewayMetadata,
		search,
		metrics,
		hasGatewayMetadata: gatewayMetadata !== undefined
	};
};

export const hasResponseDetails = (data: {
	usage?: Record<string, unknown>;
	hasGatewayMetadata: boolean;
}): boolean => data.usage !== undefined || data.hasGatewayMetadata;

export const applyGatewayCompletionMetadata = (
	message: UnknownRecord,
	data: unknown
): UnknownRecord => {
	const normalized = normalizeGatewayCompletionMetadata(data);
	if (normalized.usage) message.usage = normalized.usage;
	if (normalized.providerMetadata) message.provider_metadata = normalized.providerMetadata;
	if (normalized.gatewayMetadata) message.gateway_metadata = normalized.gatewayMetadata;
	return message;
};

export const getGatewaySearchStatusKey = (
	search: GatewaySearchMetadata | undefined
): GatewaySearchStatusKey | undefined => {
	if (!search) return undefined;

	if (search.searchStatus === 'error_fallback') return 'auto_fallback';
	if (search.searchStatus === 'error') return 'error';
	if (search.searchStatus === 'no_results') {
		return search.requestedMode === 'auto' ? 'auto_no_results' : 'on_no_results';
	}
	if (search.requestedMode === 'off') return 'off';
	if (search.requestedMode === 'auto') {
		if (search.resolvedMode === 'on' || search.webSearchUsed === true) return 'auto_used';
		if (search.resolvedMode === 'off' || search.searchStatus === 'skipped') return 'auto_skipped';
	}
	if (
		search.requestedMode === 'on' &&
		(search.resolvedMode === 'on' ||
			search.webSearchUsed === true ||
			search.searchStatus === 'success')
	) {
		return 'on';
	}
	return 'unknown';
};

export const getGatewaySearchStatusLabelKey = (status: GatewaySearchStatusKey): string =>
	({
		off: 'Off',
		on: 'On',
		auto_used: 'Auto → Used',
		auto_skipped: 'Auto → Skipped',
		auto_fallback: 'Auto → Fallback',
		on_no_results: 'On → No results',
		auto_no_results: 'Auto → No results',
		error: 'Error',
		unknown: 'Unknown'
	})[status];

export const formatIdentifier = (value: string | undefined): string | undefined =>
	value?.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

export const formatDuration = (milliseconds: number | undefined): string | undefined => {
	const value = finiteNonNegativeNumber(milliseconds);
	if (value === undefined) return undefined;
	if (value < 1000) return `${Math.round(value)} ms`;
	return `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)} s`;
};

export const formatTokenCount = (
	value: number | undefined,
	locale?: string
): string | undefined => {
	const number = finiteNonNegativeInteger(value);
	return number === undefined ? undefined : number.toLocaleString(locale);
};

export const formatTokensPerSecond = (
	value: number | undefined,
	locale?: string
): string | undefined => {
	const number = finiteNonNegativeNumber(value);
	return number === undefined
		? undefined
		: `${number.toLocaleString(locale, {
				minimumFractionDigits: 1,
				maximumFractionDigits: 2
			})} t/s`;
};

export const formatCompactDuration = (
	milliseconds: number | undefined,
	locale?: string
): string | undefined => {
	const value = finiteNonNegativeNumber(milliseconds);
	if (value === undefined) return undefined;

	const seconds = value / 1000;
	return `${seconds.toLocaleString(locale, {
		minimumFractionDigits: 1,
		maximumFractionDigits: seconds < 10 ? 2 : 1
	})}s`;
};

export const getCompactMetricSegments = (
	metrics: GatewayMetrics,
	locale?: string
): CompactMetricSegment[] => {
	const candidates: Array<CompactMetricSegment | undefined> = [
		metrics.promptTokens !== undefined
			? {
					key: 'promptTokens',
					symbol: '↑',
					label: 'Prompt tokens',
					value: formatTokenCount(metrics.promptTokens, locale)!,
					text: `↑ ${formatTokenCount(metrics.promptTokens, locale)}`
				}
			: undefined,
		metrics.completionTokens !== undefined
			? {
					key: 'completionTokens',
					symbol: '↓',
					label: 'Completion tokens',
					value: formatTokenCount(metrics.completionTokens, locale)!,
					text: `↓ ${formatTokenCount(metrics.completionTokens, locale)}`
				}
			: undefined,
		metrics.totalTokens !== undefined
			? {
					key: 'totalTokens',
					symbol: 'Σ',
					label: 'Total tokens',
					value: formatTokenCount(metrics.totalTokens, locale)!,
					text: `Σ ${formatTokenCount(metrics.totalTokens, locale)}`
				}
			: undefined,
		metrics.totalDurationMs !== undefined
			? {
					key: 'totalDurationMs',
					symbol: '⏱',
					label: 'Total duration',
					value: formatCompactDuration(metrics.totalDurationMs, locale)!,
					text: `⏱ ${formatCompactDuration(metrics.totalDurationMs, locale)}`
				}
			: undefined,
		metrics.responseTokensPerSecond !== undefined
			? {
					key: 'responseTokensPerSecond',
					symbol: '⚡',
					label: 'Generation speed',
					value: formatTokensPerSecond(metrics.responseTokensPerSecond, locale)!,
					text: `⚡ ${formatTokensPerSecond(metrics.responseTokensPerSecond, locale)}`
				}
			: undefined
	];

	return candidates.filter((segment): segment is CompactMetricSegment => segment !== undefined);
};

export const getResponseMetricDetails = (
	metrics: GatewayMetrics,
	locale?: string
): ResponseMetricDetail[] => {
	const candidates: Array<ResponseMetricDetail | undefined> = [
		metrics.promptTokens !== undefined
			? {
					key: 'promptTokens',
					label: 'Prompt tokens',
					value: formatTokenCount(metrics.promptTokens, locale)!
				}
			: undefined,
		metrics.completionTokens !== undefined
			? {
					key: 'completionTokens',
					label: 'Completion tokens',
					value: formatTokenCount(metrics.completionTokens, locale)!
				}
			: undefined,
		metrics.totalTokens !== undefined
			? {
					key: 'totalTokens',
					label: 'Total tokens',
					value: formatTokenCount(metrics.totalTokens, locale)!
				}
			: undefined,
		metrics.responseTokensPerSecond !== undefined
			? {
					key: 'responseTokensPerSecond',
					label: 'Generation speed',
					value: formatTokensPerSecond(metrics.responseTokensPerSecond, locale)!
				}
			: undefined,
		metrics.promptTokensPerSecond !== undefined
			? {
					key: 'promptTokensPerSecond',
					label: 'Prompt speed',
					value: formatTokensPerSecond(metrics.promptTokensPerSecond, locale)!
				}
			: undefined,
		metrics.totalDurationMs !== undefined
			? {
					key: 'totalDurationMs',
					label: 'Total duration',
					value: formatDuration(metrics.totalDurationMs)!
				}
			: undefined,
		metrics.llmDurationMs !== undefined
			? {
					key: 'llmDurationMs',
					label: 'LLM duration',
					value: formatDuration(metrics.llmDurationMs)!
				}
			: undefined
	];

	return candidates.filter((detail): detail is ResponseMetricDetail => detail !== undefined);
};
