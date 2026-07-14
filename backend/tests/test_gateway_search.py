from open_webui.utils.gateway_search import apply_gateway_search_mode, normalize_gateway_search_mode


def test_normalize_gateway_search_mode_uses_allowlist():
    assert normalize_gateway_search_mode('off') == 'off'
    assert normalize_gateway_search_mode('on') == 'on'
    assert normalize_gateway_search_mode('auto') == 'auto'
    assert normalize_gateway_search_mode(None) == 'off'
    assert normalize_gateway_search_mode('invalid') == 'off'


def test_apply_gateway_search_mode_preserves_supported_values_at_top_level():
    payload = {'model': 'test-model', 'messages': [], 'search_mode': 'auto'}

    result = apply_gateway_search_mode(payload, enabled=True)

    assert result == {'model': 'test-model', 'messages': [], 'search_mode': 'auto'}
    assert payload['search_mode'] == 'auto'


def test_apply_gateway_search_mode_normalizes_invalid_values():
    result = apply_gateway_search_mode({'search_mode': 'enabled'}, enabled=True)

    assert result == {'search_mode': 'off'}


def test_apply_gateway_search_mode_strips_field_for_unsupported_provider():
    result = apply_gateway_search_mode({'model': 'test-model', 'search_mode': 'on'}, enabled=False)

    assert result == {'model': 'test-model'}


def test_apply_gateway_search_mode_does_not_add_absent_field():
    payload = {'model': 'test-model'}

    assert apply_gateway_search_mode(payload, enabled=True) == payload
