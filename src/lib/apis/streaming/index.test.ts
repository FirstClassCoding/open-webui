import { describe, expect, it } from 'vitest';

import { createOpenAITextStream } from './index';

const makeStream = (events: string[]) => {
	const encoder = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(events.map((event) => `data: ${event}\n\n`).join('')));
			controller.close();
		}
	});
};

describe('createOpenAITextStream', () => {
	it('keeps content and captures final usage/Gateway metadata when choices is empty', async () => {
		const stream = makeStream([
			JSON.stringify({ choices: [{ delta: { role: 'assistant' } }] }),
			JSON.stringify({ choices: [{ delta: { content: 'Hello ' } }] }),
			JSON.stringify({ choices: [{ delta: { content: 'world' } }] }),
			JSON.stringify({ choices: [{ delta: {} }], finish_reason: 'stop' }),
			JSON.stringify({
				choices: [],
				usage: { prompt_tokens: 2, completion_tokens: 2, total_tokens: 4 },
				metadata: { provider: 'ollama' },
				gateway_metadata: { search: { requested_mode: 'auto', resolved_mode: 'on' } }
			}),
			'[DONE]',
			'[DONE]'
		]);
		const iterator = await createOpenAITextStream(stream, false);
		const updates = [];
		for await (const update of iterator) updates.push(update);

		expect(updates.map((update) => update.value).join('')).toBe('Hello world');
		expect(updates.filter((update) => update.done)).toHaveLength(1);
		const metadataUpdate = updates.find((update) => update.gatewayMetadata);
		expect(metadataUpdate?.usage?.total_tokens).toBe(4);
		expect(metadataUpdate?.providerMetadata).toEqual({ provider: 'ollama' });
		expect(metadataUpdate?.gatewayMetadata).toEqual({
			search: { requested_mode: 'auto', resolved_mode: 'on' }
		});
	});

	it('completes normally when metadata is missing', async () => {
		const stream = makeStream([
			JSON.stringify({ choices: [{ delta: { content: 'Plain response' } }] }),
			'[DONE]'
		]);
		const iterator = await createOpenAITextStream(stream, false);
		const updates = [];
		for await (const update of iterator) updates.push(update);

		expect(updates.map((update) => update.value).join('')).toBe('Plain response');
		expect(updates.some((update) => update.gatewayMetadata)).toBe(false);
	});
});
