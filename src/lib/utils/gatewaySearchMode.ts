export const GATEWAY_SEARCH_MODES = ['off', 'on', 'auto'] as const;

export type GatewaySearchMode = (typeof GATEWAY_SEARCH_MODES)[number];

export type ChatSearchOwner = 'none' | 'gateway' | 'openwebui_builtin';
export type ChatSearchConflictPreference = 'gateway' | 'openwebui_builtin';
export type ChatSearchUserAction =
	| { type: 'gateway_mode'; mode: unknown }
	| { type: 'builtin_toggle'; enabled: boolean };

export type ChatSearchPolicy = {
	searchOwner: ChatSearchOwner;
	gatewayMode: GatewaySearchMode;
	builtinSearchEnabled: boolean;
	conflictResolved: boolean;
	resolutionReason:
		| 'none_selected'
		| 'gateway_search_selected'
		| 'builtin_search_selected'
		| 'provider_unsupported';
};

type GatewaySearchModel = {
	owned_by?: string;
	direct?: boolean;
	gateway_search_mode?: boolean;
};

export const normalizeGatewaySearchMode = (value: unknown): GatewaySearchMode =>
	typeof value === 'string' && GATEWAY_SEARCH_MODES.includes(value as GatewaySearchMode)
		? (value as GatewaySearchMode)
		: 'off';

export const supportsGatewaySearchMode = (model: GatewaySearchModel | null | undefined) =>
	model?.owned_by === 'openai' && model?.direct !== true && model?.gateway_search_mode === true;

export const selectedModelsSupportGatewaySearchMode = (
	selectedModelIds: string[],
	models: Array<GatewaySearchModel & { id?: string }>
) =>
	selectedModelIds.length > 0 &&
	selectedModelIds.every((id) =>
		supportsGatewaySearchMode(models.find((model) => model.id === id))
	);

export const resolveChatSearchPolicy = ({
	gatewayMode,
	builtinSearchEnabled,
	providerSupportsGatewaySearch,
	conflictPreference = 'openwebui_builtin'
}: {
	gatewayMode: unknown;
	builtinSearchEnabled: unknown;
	providerSupportsGatewaySearch: boolean;
	conflictPreference?: ChatSearchConflictPreference;
}): ChatSearchPolicy => {
	const requestedGatewayMode = normalizeGatewaySearchMode(gatewayMode);
	const normalizedGatewayMode = providerSupportsGatewaySearch ? requestedGatewayMode : 'off';
	const normalizedBuiltinSearchEnabled = builtinSearchEnabled === true;

	if (!providerSupportsGatewaySearch && requestedGatewayMode !== 'off') {
		return {
			searchOwner: normalizedBuiltinSearchEnabled ? 'openwebui_builtin' : 'none',
			gatewayMode: 'off',
			builtinSearchEnabled: normalizedBuiltinSearchEnabled,
			conflictResolved: true,
			resolutionReason: 'provider_unsupported'
		};
	}

	if (normalizedGatewayMode !== 'off' && normalizedBuiltinSearchEnabled) {
		if (conflictPreference === 'gateway') {
			return {
				searchOwner: 'gateway',
				gatewayMode: normalizedGatewayMode,
				builtinSearchEnabled: false,
				conflictResolved: true,
				resolutionReason: 'gateway_search_selected'
			};
		}

		return {
			searchOwner: 'openwebui_builtin',
			gatewayMode: 'off',
			builtinSearchEnabled: true,
			conflictResolved: true,
			resolutionReason: 'builtin_search_selected'
		};
	}

	if (normalizedGatewayMode !== 'off') {
		return {
			searchOwner: 'gateway',
			gatewayMode: normalizedGatewayMode,
			builtinSearchEnabled: false,
			conflictResolved: false,
			resolutionReason: 'gateway_search_selected'
		};
	}

	if (normalizedBuiltinSearchEnabled) {
		return {
			searchOwner: 'openwebui_builtin',
			gatewayMode: 'off',
			builtinSearchEnabled: true,
			conflictResolved: false,
			resolutionReason: 'builtin_search_selected'
		};
	}

	return {
		searchOwner: 'none',
		gatewayMode: 'off',
		builtinSearchEnabled: false,
		conflictResolved: false,
		resolutionReason: 'none_selected'
	};
};

export const resolveChatSearchUserAction = ({
	action,
	gatewayMode,
	builtinSearchEnabled,
	providerSupportsGatewaySearch
}: {
	action: ChatSearchUserAction;
	gatewayMode: unknown;
	builtinSearchEnabled: unknown;
	providerSupportsGatewaySearch: boolean;
}): ChatSearchPolicy =>
	resolveChatSearchPolicy({
		gatewayMode: action.type === 'gateway_mode' ? action.mode : gatewayMode,
		builtinSearchEnabled: action.type === 'builtin_toggle' ? action.enabled : builtinSearchEnabled,
		providerSupportsGatewaySearch,
		conflictPreference: action.type === 'gateway_mode' ? 'gateway' : 'openwebui_builtin'
	});

export const getGatewaySearchModeField = (
	selectedModelIds: string[],
	models: Array<GatewaySearchModel & { id?: string }>,
	value: unknown
): { search_mode: GatewaySearchMode } | Record<string, never> => {
	if (!selectedModelsSupportGatewaySearchMode(selectedModelIds, models)) {
		return {};
	}

	return { search_mode: normalizeGatewaySearchMode(value) };
};

export const getChatSearchRequestPolicy = (
	selectedModelIds: string[],
	models: Array<GatewaySearchModel & { id?: string }>,
	gatewayMode: unknown,
	builtinSearchEnabled: unknown
) => {
	const providerSupportsGatewaySearch = selectedModelsSupportGatewaySearchMode(
		selectedModelIds,
		models
	);
	const policy = resolveChatSearchPolicy({
		gatewayMode,
		builtinSearchEnabled,
		providerSupportsGatewaySearch,
		conflictPreference: 'openwebui_builtin'
	});

	return {
		...policy,
		gatewaySearchModeField: providerSupportsGatewaySearch ? { search_mode: policy.gatewayMode } : {}
	};
};
