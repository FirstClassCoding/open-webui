from typing import Any

PROVIDER_METADATA_KEYS = frozenset(
    {
        'provider',
        'response_token_s',
        'prompt_token_s',
        'prompt_eval_count',
        'eval_count',
    }
)

SEARCH_METADATA_KEYS = frozenset(
    {
        'requested_mode',
        'resolved_mode',
        'web_search_used',
        'search_status',
        'decision_reason',
        'classifier',
        'query',
        'search_result_count',
        'search_duration_ms',
    }
)

SOURCE_KEYS = frozenset({'index', 'title', 'url', 'engine'})
METRICS_KEYS = frozenset({'total_duration_ms', 'llm_duration_ms', 'tokens_per_second'})


def _copy_known_fields(value: Any, keys: frozenset[str]) -> dict:
    if not isinstance(value, dict):
        return {}

    return {key: value[key] for key in keys if key in value and isinstance(value[key], (str, int, float, bool))}


def _normalize_sources(value: Any) -> list[dict]:
    if not isinstance(value, list):
        return []

    sources = []
    for item in value[:50]:
        source = _copy_known_fields(item, SOURCE_KEYS)
        if source:
            sources.append(source)
    return sources


def normalize_gateway_metadata(value: Any) -> dict:
    if not isinstance(value, dict):
        return {}

    normalized = {}
    search = _copy_known_fields(value.get('search'), SEARCH_METADATA_KEYS)
    if isinstance(value.get('search'), dict) and 'sources' in value['search']:
        search['sources'] = _normalize_sources(value['search'].get('sources'))
    if search:
        normalized['search'] = search

    metrics = _copy_known_fields(value.get('metrics'), METRICS_KEYS)
    if metrics:
        normalized['metrics'] = metrics

    return normalized


def normalize_completion_metadata(response_data: Any) -> dict:
    """Return the provider fields that are safe and useful to persist with a chat message."""
    if not isinstance(response_data, dict):
        return {}

    normalized = {}
    provider_metadata = _copy_known_fields(response_data.get('metadata'), PROVIDER_METADATA_KEYS)
    gateway_metadata = normalize_gateway_metadata(response_data.get('gateway_metadata'))

    if provider_metadata:
        normalized['provider_metadata'] = provider_metadata
    if gateway_metadata:
        normalized['gateway_metadata'] = gateway_metadata

    return normalized


def completion_metadata_to_response_fields(metadata: Any) -> dict:
    """Map persisted message field names back to the Gateway response/event contract."""
    if not isinstance(metadata, dict):
        return {}

    response_fields = {}
    if isinstance(metadata.get('provider_metadata'), dict):
        response_fields['metadata'] = metadata['provider_metadata']
    if isinstance(metadata.get('gateway_metadata'), dict):
        response_fields['gateway_metadata'] = metadata['gateway_metadata']
    return response_fields
