import { describe, expect, it } from 'vitest';

import {
	applyGatewayCompletionMetadata,
	formatDuration,
	getCompactMetricSegments,
	getGatewaySearchStatusKey,
	getResponseMetricDetails,
	getSafeHttpUrl,
	hasResponseDetails,
	normalizeGatewayCompletionMetadata
} from './gatewayCompletionMetadata';

const response = {
	usage: {
		prompt_tokens: 2259,
		input_tokens: 9999,
		completion_tokens: 866,
		output_tokens: 9999,
		total_tokens: 3125,
		'response_token/s': 37.74,
		'prompt_token/s': 567.17,
		total_duration: 24_041_849_200
	},
	metadata: {
		provider: 'ollama',
		response_token_s: 99,
		prompt_eval_count: 111,
		authorization: 'ignored'
	},
	gateway_metadata: {
		search: {
			requested_mode: 'auto',
			resolved_mode: 'on',
			web_search_used: true,
			search_status: 'success',
			decision_reason: 'market_signal',
			search_result_count: 2,
			search_duration_ms: 1360,
			sources: [
				{ index: 2, title: 'Second', url: 'https://www.example.org/two', engine: 'b' },
				{ index: 1, title: 'First', url: 'https://example.com/one', engine: 'a' }
			]
		},
		metrics: {
			total_duration_ms: 25507,
			llm_duration_ms: 24085,
			tokens_per_second: 35.95
		}
	}
};

describe('normalizeGatewayCompletionMetadata', () => {
	it('uses the required metric priorities and units', () => {
		const normalized = normalizeGatewayCompletionMetadata(response);

		expect(normalized.metrics).toEqual({
			promptTokens: 2259,
			completionTokens: 866,
			totalTokens: 3125,
			responseTokensPerSecond: 37.74,
			promptTokensPerSecond: 567.17,
			totalDurationMs: 25507,
			searchDurationMs: 1360,
			llmDurationMs: 24085
		});
		expect(normalized.search?.sources.map((source) => source.index)).toEqual([1, 2]);
		expect(normalized.search?.sources[0].domain).toBe('example.com');
	});

	it('falls back from OpenAI token names and nanosecond duration', () => {
		const normalized = normalizeGatewayCompletionMetadata({
			usage: { input_tokens: 10, output_tokens: 5, total_duration: 1_500_000_000 },
			metadata: { response_token_s: 12.5 },
			gateway_metadata: { metrics: { tokens_per_second: 8 } }
		});

		expect(normalized.metrics.promptTokens).toBe(10);
		expect(normalized.metrics.completionTokens).toBe(5);
		expect(normalized.metrics.totalTokens).toBe(15);
		expect(normalized.metrics.responseTokensPerSecond).toBe(12.5);
		expect(normalized.metrics.totalDurationMs).toBe(1500);
	});

	it('accepts safe numeric strings and provider duration nanoseconds', () => {
		const normalized = normalizeGatewayCompletionMetadata({
			usage: {
				prompt_tokens: '22',
				completion_tokens: '617',
				'response_token/s': '40.57'
			},
			provider_metadata: {
				prompt_token_s: '567.17',
				total_duration: '17356583200'
			}
		});

		expect(normalized.metrics).toEqual({
			promptTokens: 22,
			completionTokens: 617,
			totalTokens: 639,
			responseTokensPerSecond: 40.57,
			promptTokensPerSecond: 567.17,
			totalDurationMs: 17356.5832,
			searchDurationMs: undefined,
			llmDurationMs: undefined
		});
	});

	it('ignores malformed numbers, sections, and unsafe URLs', () => {
		const normalized = normalizeGatewayCompletionMetadata({
			usage: {
				prompt_tokens: 'many',
				completion_tokens: -1,
				input_tokens: '0x10',
				output_tokens: '1,000',
				'response_token/s': Infinity,
				'prompt_token/s': NaN
			},
			gateway_metadata: {
				search: {
					requested_mode: 'on',
					search_duration_ms: -5,
					sources: [
						{ index: 1, title: '<img src=x>', url: 'javascript:alert(1)' },
						{ index: 2, title: 'Data', url: 'data:text/html,test' }
					]
				},
				metrics: { total_duration_ms: 'fast' }
			}
		});

		expect(normalized.metrics.promptTokens).toBeUndefined();
		expect(normalized.metrics.completionTokens).toBeUndefined();
		expect(normalized.metrics.totalTokens).toBeUndefined();
		expect(normalized.metrics.promptTokensPerSecond).toBeUndefined();
		expect(normalized.metrics.totalDurationMs).toBeUndefined();
		expect(normalized.search?.sources.every((source) => source.url === undefined)).toBe(true);
	});

	it('does not expose unknown provider or Gateway fields', () => {
		const normalized = normalizeGatewayCompletionMetadata(response);
		expect(normalized.providerMetadata).not.toHaveProperty('authorization');
		expect(normalized.gatewayMetadata).not.toHaveProperty('secret');
	});
});

describe('response metrics presentation', () => {
	it('formats the compact row in the required order', () => {
		const normalized = normalizeGatewayCompletionMetadata(response);

		expect(
			getCompactMetricSegments(normalized.metrics, 'en-US').map((segment) => segment.text)
		).toEqual(['↑ 2,259', '↓ 866', 'Σ 3,125', '⏱ 25.5s', '⚡ 37.74 t/s']);
	});

	it('omits unavailable segments and exposes prompt speed in details only', () => {
		const metrics = normalizeGatewayCompletionMetadata({
			usage: { prompt_tokens: 4, 'prompt_token/s': 12.25 }
		}).metrics;

		expect(getCompactMetricSegments(metrics, 'en-US').map((segment) => segment.key)).toEqual([
			'promptTokens',
			'totalTokens'
		]);
		expect(getResponseMetricDetails(metrics, 'en-US')).toContainEqual({
			key: 'promptTokensPerSecond',
			label: 'Prompt speed',
			value: '12.25 t/s'
		});
	});

	it('keeps usage-only and Gateway-only response details visible', () => {
		const usageOnly = normalizeGatewayCompletionMetadata({ usage: { prompt_tokens: 1 } });
		const gatewayOnly = normalizeGatewayCompletionMetadata({
			gateway_metadata: { search: { requested_mode: 'off', sources: [] } }
		});
		const empty = normalizeGatewayCompletionMetadata({});

		expect(hasResponseDetails(usageOnly)).toBe(true);
		expect(hasResponseDetails(gatewayOnly)).toBe(true);
		expect(hasResponseDetails(empty)).toBe(false);
	});

	it('keeps direct provider usage independent from Gateway search metadata', () => {
		const direct = normalizeGatewayCompletionMetadata({
			usage: { prompt_tokens: 10, completion_tokens: 5, total_duration: 1_000_000_000 }
		});

		expect(direct.hasGatewayMetadata).toBe(false);
		expect(direct.search).toBeUndefined();
		expect(getCompactMetricSegments(direct.metrics, 'en-US').length).toBeGreaterThan(0);
	});
});

describe('getGatewaySearchStatusKey', () => {
	it.each([
		[{ requestedMode: 'off', sources: [] }, 'off'],
		[{ requestedMode: 'on', webSearchUsed: true, searchStatus: 'success', sources: [] }, 'on'],
		[{ requestedMode: 'auto', resolvedMode: 'on', sources: [] }, 'auto_used'],
		[
			{ requestedMode: 'auto', resolvedMode: 'off', searchStatus: 'skipped', sources: [] },
			'auto_skipped'
		],
		[{ requestedMode: 'auto', searchStatus: 'error_fallback', sources: [] }, 'auto_fallback'],
		[{ requestedMode: 'on', searchStatus: 'no_results', sources: [] }, 'on_no_results'],
		[{ requestedMode: 'auto', searchStatus: 'no_results', sources: [] }, 'auto_no_results'],
		[{ requestedMode: 'on', searchStatus: 'error', sources: [] }, 'error'],
		[{ requestedMode: 'future', searchStatus: 'new_status', sources: [] }, 'unknown']
	])('maps %#', (search, expected) => {
		expect(getGatewaySearchStatusKey(search)).toBe(expected);
	});
});

describe('message persistence shape', () => {
	it('applies stream and non-stream metadata to the same assistant message shape', () => {
		const streamMessage = applyGatewayCompletionMetadata(
			{ id: 'stream', content: 'answer' },
			response
		);
		const nonStreamMessage = applyGatewayCompletionMetadata(
			{ id: 'non-stream', content: 'answer' },
			response
		);

		expect(streamMessage.usage).toEqual(nonStreamMessage.usage);
		expect(streamMessage.gateway_metadata).toEqual(nonStreamMessage.gateway_metadata);
		expect(JSON.parse(JSON.stringify(streamMessage))).toEqual(streamMessage);
	});

	it('keeps metadata isolated between assistant messages', () => {
		const first = applyGatewayCompletionMetadata({ id: 'first' }, response);
		const second = applyGatewayCompletionMetadata(
			{ id: 'second' },
			{ gateway_metadata: { search: { requested_mode: 'off' } } }
		);

		(first.gateway_metadata as Record<string, unknown>).changed = true;
		expect(second.gateway_metadata).not.toHaveProperty('changed');
	});
});

describe('formatting and URL safety', () => {
	it('allows only absolute HTTP(S) source URLs', () => {
		expect(getSafeHttpUrl('https://example.com/a')).toBe('https://example.com/a');
		expect(getSafeHttpUrl('http://example.com')).toBe('http://example.com/');
		expect(getSafeHttpUrl('javascript:alert(1)')).toBeUndefined();
		expect(getSafeHttpUrl('data:text/html,test')).toBeUndefined();
		expect(getSafeHttpUrl('/relative')).toBeUndefined();
	});

	it('formats milliseconds without confusing them with nanoseconds', () => {
		expect(formatDuration(850)).toBe('850 ms');
		expect(formatDuration(25_507)).toBe('25.5 s');
		expect(formatDuration(-1)).toBeUndefined();
	});
});
