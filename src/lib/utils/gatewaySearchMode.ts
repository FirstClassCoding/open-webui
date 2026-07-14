export const GATEWAY_SEARCH_MODES = ['off', 'on', 'auto'] as const;

export type GatewaySearchMode = (typeof GATEWAY_SEARCH_MODES)[number];

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

export const getGatewaySearchModeField = (
	selectedModelIds: string[],
	models: Array<GatewaySearchModel & { id?: string }>,
	value: unknown
): { search_mode: GatewaySearchMode } | Record<string, never> => {
	if (
		selectedModelIds.length === 0 ||
		!selectedModelIds.every((id) =>
			supportsGatewaySearchMode(models.find((model) => model.id === id))
		)
	) {
		return {};
	}

	return { search_mode: normalizeGatewaySearchMode(value) };
};
