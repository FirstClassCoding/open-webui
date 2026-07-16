import { describe, expect, it } from 'vitest';

import {
	getChatSearchRequestPolicy,
	resolveChatSearchPolicy,
	resolveChatSearchUserAction
} from './gatewaySearchMode';

const gatewayModel = {
	id: 'gateway-model',
	owned_by: 'openai',
	direct: false,
	gateway_search_mode: true
};

const resolve = (
	gatewayMode: unknown,
	builtinSearchEnabled: unknown,
	conflictPreference: 'gateway' | 'openwebui_builtin' = 'openwebui_builtin',
	providerSupportsGatewaySearch = true
) =>
	resolveChatSearchPolicy({
		gatewayMode,
		builtinSearchEnabled,
		providerSupportsGatewaySearch,
		conflictPreference
	});

const resolveUserActionAndRequest = ({
	gatewayMode,
	builtinSearchEnabled,
	action,
	models = [gatewayModel],
	selectedModelIds = [gatewayModel.id]
}: {
	gatewayMode: unknown;
	builtinSearchEnabled: boolean;
	action: { type: 'gateway_mode'; mode: unknown } | { type: 'builtin_toggle'; enabled: boolean };
	models?: Array<{
		id: string;
		owned_by?: string;
		direct?: boolean;
		gateway_search_mode?: boolean;
	}>;
	selectedModelIds?: string[];
}) => {
	const providerSupportsGatewaySearch =
		selectedModelIds.length > 0 &&
		selectedModelIds.every((id) =>
			models.some(
				(model) =>
					model.id === id &&
					model.owned_by === 'openai' &&
					model.direct !== true &&
					model.gateway_search_mode === true
			)
		);
	const uiPolicy = resolveChatSearchUserAction({
		action,
		gatewayMode,
		builtinSearchEnabled,
		providerSupportsGatewaySearch
	});
	const requestPolicy = getChatSearchRequestPolicy(
		selectedModelIds,
		models,
		uiPolicy.gatewayMode,
		uiPolicy.builtinSearchEnabled
	);

	return { uiPolicy, requestPolicy };
};

describe('resolveChatSearchPolicy', () => {
	it('selects no owner when both search systems are off', () => {
		expect(resolve('off', false)).toMatchObject({
			searchOwner: 'none',
			gatewayMode: 'off',
			builtinSearchEnabled: false
		});
	});

	it('selects the built-in owner when Gateway search is off', () => {
		expect(resolve('off', true)).toMatchObject({
			searchOwner: 'openwebui_builtin',
			gatewayMode: 'off',
			builtinSearchEnabled: true
		});
	});

	it.each(['on', 'auto'] as const)(
		'gives Gateway %s priority after a Gateway user action',
		(mode) => {
			expect(resolve(mode, true, 'gateway')).toMatchObject({
				searchOwner: 'gateway',
				gatewayMode: mode,
				builtinSearchEnabled: false,
				conflictResolved: true,
				resolutionReason: 'gateway_search_selected'
			});
		}
	);

	it.each(['on', 'auto'] as const)(
		'gives built-in search priority over Gateway %s after a built-in user action or legacy load',
		(mode) => {
			expect(resolve(mode, true, 'openwebui_builtin')).toMatchObject({
				searchOwner: 'openwebui_builtin',
				gatewayMode: 'off',
				builtinSearchEnabled: true,
				conflictResolved: true,
				resolutionReason: 'builtin_search_selected'
			});
		}
	);

	it('forces Gateway off for an unsupported provider without changing built-in search', () => {
		expect(resolve('auto', true, 'gateway', false)).toMatchObject({
			searchOwner: 'openwebui_builtin',
			gatewayMode: 'off',
			builtinSearchEnabled: true,
			resolutionReason: 'provider_unsupported'
		});
	});

	it('falls back safely for invalid or missing persisted state', () => {
		expect(resolve('invalid', false)).toMatchObject({ searchOwner: 'none', gatewayMode: 'off' });
		expect(resolve(undefined, false)).toMatchObject({ searchOwner: 'none', gatewayMode: 'off' });
		expect(resolve(null, true)).toMatchObject({
			searchOwner: 'openwebui_builtin',
			gatewayMode: 'off'
		});
	});
});

describe('getChatSearchRequestPolicy', () => {
	it.each(['on', 'auto'] as const)(
		'sends Gateway %s and disables the built-in request feature',
		(mode) => {
			const result = getChatSearchRequestPolicy([gatewayModel.id], [gatewayModel], mode, false);

			expect(result).toMatchObject({
				searchOwner: 'gateway',
				gatewayMode: mode,
				builtinSearchEnabled: false,
				gatewaySearchModeField: { search_mode: mode }
			});
		}
	);

	it('defensively gives an active built-in feature priority over a stale Gateway mode', () => {
		const result = getChatSearchRequestPolicy([gatewayModel.id], [gatewayModel], 'auto', true);

		expect(result).toMatchObject({
			searchOwner: 'openwebui_builtin',
			gatewayMode: 'off',
			builtinSearchEnabled: true,
			gatewaySearchModeField: { search_mode: 'off' }
		});
	});

	it('strips search_mode for Direct Ollama, Responses API, and unsupported providers', () => {
		const models = [
			{ id: 'ollama', owned_by: 'ollama', direct: true },
			{ id: 'responses', owned_by: 'openai', direct: false, gateway_search_mode: false },
			{ id: 'unsupported', owned_by: 'openai', direct: false }
		];

		for (const model of models) {
			expect(getChatSearchRequestPolicy([model.id], models, 'on', false)).toMatchObject({
				searchOwner: 'none',
				gatewayMode: 'off',
				gatewaySearchModeField: {}
			});
		}
	});

	it('fails closed for a mixed-model request', () => {
		const result = getChatSearchRequestPolicy(
			[gatewayModel.id, 'other'],
			[gatewayModel, { id: 'other', owned_by: 'openai', direct: false }],
			'auto',
			false
		);

		expect(result).toMatchObject({
			searchOwner: 'none',
			gatewayMode: 'off',
			gatewaySearchModeField: {}
		});
	});

	it('never produces two search owners for one request', () => {
		for (const gatewayMode of ['off', 'on', 'auto', 'invalid']) {
			for (const builtinSearchEnabled of [false, true]) {
				const result = getChatSearchRequestPolicy(
					[gatewayModel.id],
					[gatewayModel],
					gatewayMode,
					builtinSearchEnabled
				);
				const gatewaySearchActive = result.gatewayMode !== 'off';

				expect(gatewaySearchActive && result.builtinSearchEnabled).toBe(false);
			}
		}
	});
});

describe('user action to immediate completion payload', () => {
	it.each(['auto', 'on'] as const)(
		'keeps built-in search enabled when it takes ownership from Gateway %s',
		(gatewayMode) => {
			const { uiPolicy, requestPolicy } = resolveUserActionAndRequest({
				gatewayMode,
				builtinSearchEnabled: false,
				action: { type: 'builtin_toggle', enabled: true }
			});

			expect(uiPolicy).toMatchObject({
				searchOwner: 'openwebui_builtin',
				gatewayMode: 'off',
				builtinSearchEnabled: true,
				conflictResolved: true
			});
			expect(requestPolicy).toMatchObject({
				searchOwner: 'openwebui_builtin',
				gatewaySearchModeField: { search_mode: 'off' },
				builtinSearchEnabled: true
			});
		}
	);

	it.each(['auto', 'on'] as const)(
		'gives Gateway %s ownership and disables built-in search in the same cycle',
		(mode) => {
			const { uiPolicy, requestPolicy } = resolveUserActionAndRequest({
				gatewayMode: 'off',
				builtinSearchEnabled: true,
				action: { type: 'gateway_mode', mode }
			});

			expect(uiPolicy).toMatchObject({
				searchOwner: 'gateway',
				gatewayMode: mode,
				builtinSearchEnabled: false,
				conflictResolved: true
			});
			expect(requestPolicy).toMatchObject({
				searchOwner: 'gateway',
				gatewaySearchModeField: { search_mode: mode },
				builtinSearchEnabled: false
			});
		}
	);

	it('keeps both request search mechanisms off when neither owns the request', () => {
		const { uiPolicy, requestPolicy } = resolveUserActionAndRequest({
			gatewayMode: 'off',
			builtinSearchEnabled: true,
			action: { type: 'builtin_toggle', enabled: false }
		});

		expect(uiPolicy).toMatchObject({
			searchOwner: 'none',
			gatewayMode: 'off',
			builtinSearchEnabled: false
		});
		expect(requestPolicy).toMatchObject({
			gatewaySearchModeField: { search_mode: 'off' },
			builtinSearchEnabled: false
		});
	});

	it('preserves built-in search for Direct Ollama without sending search_mode', () => {
		const directOllama = { id: 'ollama', owned_by: 'ollama', direct: true };
		const { uiPolicy, requestPolicy } = resolveUserActionAndRequest({
			gatewayMode: 'off',
			builtinSearchEnabled: false,
			action: { type: 'builtin_toggle', enabled: true },
			models: [directOllama],
			selectedModelIds: [directOllama.id]
		});

		expect(uiPolicy).toMatchObject({
			searchOwner: 'openwebui_builtin',
			gatewayMode: 'off',
			builtinSearchEnabled: true
		});
		expect(requestPolicy).toMatchObject({
			searchOwner: 'openwebui_builtin',
			gatewaySearchModeField: {},
			builtinSearchEnabled: true
		});
	});

	it('fails Gateway closed for mixed models without disabling explicit built-in search', () => {
		const otherModel = { id: 'other', owned_by: 'openai', direct: false };
		const { uiPolicy, requestPolicy } = resolveUserActionAndRequest({
			gatewayMode: 'auto',
			builtinSearchEnabled: false,
			action: { type: 'builtin_toggle', enabled: true },
			models: [gatewayModel, otherModel],
			selectedModelIds: [gatewayModel.id, otherModel.id]
		});

		expect(uiPolicy).toMatchObject({
			searchOwner: 'openwebui_builtin',
			gatewayMode: 'off',
			builtinSearchEnabled: true
		});
		expect(requestPolicy).toMatchObject({
			searchOwner: 'openwebui_builtin',
			gatewaySearchModeField: {},
			builtinSearchEnabled: true
		});
	});

	it('only marks an explicit conflicting user action for one toast', () => {
		const { uiPolicy } = resolveUserActionAndRequest({
			gatewayMode: 'auto',
			builtinSearchEnabled: false,
			action: { type: 'builtin_toggle', enabled: true }
		});
		const toastCount = Number(
			uiPolicy.conflictResolved && uiPolicy.searchOwner === 'openwebui_builtin'
		);

		expect(toastCount).toBe(1);
		// Legacy normalization calls resolveChatSearchPolicy directly and therefore has no toast path.
		expect(resolve('auto', true, 'openwebui_builtin').conflictResolved).toBe(true);
	});
});
