import { describe, expect, it } from 'vitest';

import {
	getGatewaySearchModeField,
	normalizeGatewaySearchMode,
	supportsGatewaySearchMode
} from './gatewaySearchMode';

const gatewayModel = {
	id: 'gateway-model',
	owned_by: 'openai',
	direct: false,
	gateway_search_mode: true
};

describe('normalizeGatewaySearchMode', () => {
	it.each([
		['off', 'off'],
		['on', 'on'],
		['auto', 'auto'],
		[undefined, 'off'],
		[null, 'off'],
		['invalid', 'off']
	])('normalizes %s to %s', (value, expected) => {
		expect(normalizeGatewaySearchMode(value)).toBe(expected);
	});
});

describe('getGatewaySearchModeField', () => {
	it.each(['off', 'on', 'auto'])('adds %s as a top-level request field', (mode) => {
		expect(getGatewaySearchModeField([gatewayModel.id], [gatewayModel], mode)).toEqual({
			search_mode: mode
		});
	});

	it('uses off for an existing chat without a stored mode', () => {
		expect(getGatewaySearchModeField([gatewayModel.id], [gatewayModel], undefined)).toEqual({
			search_mode: 'off'
		});
	});

	it('does not add the field to direct Ollama or unsupported OpenAI models', () => {
		const models = [
			{ id: 'ollama', owned_by: 'ollama', direct: true },
			{ id: 'openai', owned_by: 'openai', direct: false }
		];

		expect(getGatewaySearchModeField(['ollama'], models, 'on')).toEqual({});
		expect(getGatewaySearchModeField(['openai'], models, 'on')).toEqual({});
	});

	it('fails closed when a multi-model selection contains an unsupported model', () => {
		const models = [gatewayModel, { id: 'other', owned_by: 'openai', direct: false }];

		expect(getGatewaySearchModeField(['gateway-model', 'other'], models, 'auto')).toEqual({});
	});
});

describe('supportsGatewaySearchMode', () => {
	it('requires an enabled non-direct OpenAI-compatible model', () => {
		expect(supportsGatewaySearchMode(gatewayModel)).toBe(true);
		expect(supportsGatewaySearchMode({ ...gatewayModel, direct: true })).toBe(false);
		expect(supportsGatewaySearchMode({ ...gatewayModel, owned_by: 'ollama' })).toBe(false);
		expect(supportsGatewaySearchMode({ ...gatewayModel, gateway_search_mode: false })).toBe(false);
	});
});
