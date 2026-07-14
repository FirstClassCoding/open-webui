SUPPORTED_GATEWAY_SEARCH_MODES = frozenset({'off', 'on', 'auto'})


def normalize_gateway_search_mode(value) -> str:
    return value if isinstance(value, str) and value in SUPPORTED_GATEWAY_SEARCH_MODES else 'off'


def apply_gateway_search_mode(payload: dict, *, enabled: bool) -> dict:
    normalized_payload = {**payload}
    if 'search_mode' not in normalized_payload:
        return normalized_payload

    search_mode = normalize_gateway_search_mode(normalized_payload.pop('search_mode'))
    if enabled:
        normalized_payload['search_mode'] = search_mode

    return normalized_payload
