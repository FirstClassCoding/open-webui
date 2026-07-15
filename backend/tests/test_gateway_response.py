import unittest

from open_webui.utils.gateway_response import (
    completion_metadata_to_response_fields,
    normalize_completion_metadata,
    normalize_gateway_metadata,
)


class GatewayResponseMetadataTests(unittest.TestCase):
    def test_normalizes_only_ui_metadata(self):
        result = normalize_completion_metadata(
            {
                'metadata': {
                    'provider': 'ollama',
                    'response_token_s': 37.74,
                    'authorization': 'must-not-be-stored',
                },
                'gateway_metadata': {
                    'search': {
                        'requested_mode': 'auto',
                        'resolved_mode': 'on',
                        'search_status': 'success',
                        'search_log_id': 'internal-id',
                        'sources': [
                            {
                                'index': 1,
                                'title': 'Example',
                                'url': 'https://example.com',
                                'engine': 'searxng',
                                'snippet': 'not persisted',
                            }
                        ],
                    },
                    'metrics': {
                        'total_duration_ms': 1000,
                        'tokens_per_second': 20.5,
                        'unknown': 'ignored',
                    },
                },
            }
        )

        self.assertEqual(result['provider_metadata'], {'provider': 'ollama', 'response_token_s': 37.74})
        self.assertNotIn('search_log_id', result['gateway_metadata']['search'])
        self.assertEqual(
            result['gateway_metadata']['search']['sources'],
            [{'index': 1, 'title': 'Example', 'url': 'https://example.com', 'engine': 'searxng'}],
        )
        self.assertEqual(
            result['gateway_metadata']['metrics'],
            {'total_duration_ms': 1000, 'tokens_per_second': 20.5},
        )

    def test_ignores_malformed_sections(self):
        self.assertEqual(normalize_gateway_metadata(None), {})
        self.assertEqual(
            normalize_gateway_metadata({'search': 'bad', 'metrics': [], 'other': {'nested': True}}),
            {},
        )

    def test_maps_message_fields_to_response_contract(self):
        metadata = {
            'provider_metadata': {'provider': 'ollama'},
            'gateway_metadata': {'search': {'requested_mode': 'off'}},
        }
        self.assertEqual(
            completion_metadata_to_response_fields(metadata),
            {
                'metadata': {'provider': 'ollama'},
                'gateway_metadata': {'search': {'requested_mode': 'off'}},
            },
        )


if __name__ == '__main__':
    unittest.main()
