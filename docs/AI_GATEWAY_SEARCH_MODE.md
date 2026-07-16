# AI Gateway Search Mode (Phases 4A, 4B, and 4C)

Phase 4A adds a compact **Gateway Web Search** selector to the main chat composer. It sends the selected mode to a compatible AI Gateway connection without changing Open WebUI's built-in web search.

## Request contract

Supported values are `off`, `on`, and `auto`. New chats and chats without a stored value use `off`.

For the main assistant chat completion, the value is sent as a top-level field:

```json
{
	"model": "configured-model-id",
	"messages": [{ "role": "user", "content": "Current information request" }],
	"stream": true,
	"search_mode": "auto"
}
```

The same field is used for streaming and non-streaming main chat requests. Send, edit and resend, regenerate, continue generation, and retry all use the current per-chat mode through the shared completion path. Internal requests such as title, tag, follow-up, autocomplete, model listing, and other background tasks do not receive this field.

## Connection configuration

The selector is fail-closed. An administrator must edit the relevant OpenAI-compatible connection and enable **Gateway Web Search**. Open WebUI then marks models from that connection as supporting the custom field.

The field is not sent to:

- Direct Ollama models
- OpenAI-compatible connections without the capability enabled
- Responses API connections
- Mixed model selections where any selected model does not support the capability

No Gateway URL, model name, or credential is hardcoded. Invalid or untrusted stored values normalize to `off`.

## Persistence

The selected value is stored once in the existing chat JSON as `gateway_search_mode`; no database migration is required. Existing chats remain compatible and default to `off`.

## Search ownership (Phase 4C)

Gateway Web Search and Open WebUI's built-in web search remain separate systems, but Phase 4C gives every main completion request exactly one search owner:

| Gateway mode | Built-in search | Request owner       |
| ------------ | --------------- | ------------------- |
| `off`        | Off             | `none`              |
| `off`        | On              | `openwebui_builtin` |
| `on`         | Off             | `gateway`           |
| `auto`       | Off             | `gateway`           |

Selecting Gateway `on` or `auto` turns built-in search off. Turning built-in search on changes Gateway mode to `off`. A short toast explains changes caused by an explicit user action; normalization during load is silent.

The built-in toggle callback synchronously commits both resolved values to the parent chat state. The visible built-in state and `features.web_search` must therefore agree even when the user sends immediately after toggling. Gateway `off` does not by itself mean that no search owner exists: built-in search can own the request with `search_mode=off` and `features.web_search=true`. The defensive request guard always evaluates both values.

The same policy helper is used by the composer and immediately before the main completion payload is created. The request guard prevents `features.web_search=true` from being sent with Gateway `search_mode=on|auto`. Gateway-capable providers receive `search_mode=off` when built-in search owns the request. Unsupported providers, Direct Ollama, Responses API connections, and mixed-model selections do not receive `search_mode`.

`gateway_search_mode` continues to use the existing chat JSON. Draft state continues to use Open WebUI's existing session storage, so no migration is required. If an old chat or draft contains a conflict, built-in search has priority because it is the older persisted feature. Model/provider switches use the safe `off` fallback instead of carrying a hidden Gateway mode to another provider. Temporary chats apply the same policy in memory.

Send, edit/resend, regenerate, continue, and retry converge on the guarded main completion path and use the current chat state. Internal and background tasks do not receive Gateway mode. Gateway `auto` remains the owner when it resolves to Used, Skipped, Fallback, No Results, or Error; neither search system automatically falls back to the other.

## Response metadata (Phase 4B)

Phase 4B reads `usage`, provider `metadata`, and `gateway_metadata` from both non-stream responses and the final SSE chunk. A final chunk with `choices: []` is treated as metadata for the current Assistant message; it does not create another message or replace streamed content.

The normalized fields are stored with each Assistant message in the existing chat history JSON:

- `usage`: provider token and timing values
- `provider_metadata`: the provider name and token-rate/count fields used by the UI
- `gateway_metadata`: normalized `search` and `metrics` fields

The message JSON already accepts optional fields, so no database migration is required. Reloading a chat restores the metadata, while existing chats without these fields continue to render normally. Regenerate and edit/resend create messages with their own metadata; continue generation updates the message being continued.

### Search status

The Assistant message displays a compact Gateway status only when `gateway_metadata.search` exists:

| Gateway result                     | Display               |
| ---------------------------------- | --------------------- |
| `requested_mode=off`               | Off                   |
| `requested_mode=on`, search used   | On                    |
| `requested_mode=auto`, resolved on | Auto -> Used          |
| `requested_mode=auto`, skipped     | Auto -> Skipped       |
| `search_status=error_fallback`     | Auto -> Fallback      |
| `search_status=no_results`         | On/Auto -> No results |
| `search_status=error`              | Error                 |

The detail tooltip can show requested and resolved modes, status, decision reason, result count, search time, classifier, and a truncated query. Internal `search_log_id` values are not displayed or persisted in the normalized UI metadata.

### Gateway sources

Gateway sources are shown in a separate collapsible list and remain distinct from Open WebUI built-in citations. They are ordered by `index` so `[1]`, `[2]`, and later references remain aligned with the Gateway answer. Only absolute `http://` and `https://` URLs are clickable; links open in a new tab with `noopener noreferrer`. Titles are rendered as text, snippets are not invented, and no page is fetched again. Phase 4C does not merge the source lists or citation indexes.

The built-in `Citations` component was not reused because it expects document/snippet metadata that the Gateway source contract does not provide.

### Metrics priority

The existing Assistant message information tooltip is extended for Gateway responses. Values use this order:

- Prompt tokens: `usage.prompt_tokens`, then `usage.input_tokens`, then provider prompt count
- Completion tokens: `usage.completion_tokens`, then `usage.output_tokens`, then provider completion count
- Total tokens: `usage.total_tokens`, then prompt plus completion
- Generation speed: `usage["response_token/s"]`, then `metadata.response_token_s`, then Gateway throughput
- Total duration: `gateway_metadata.metrics.total_duration_ms`, then provider `total_duration` converted from nanoseconds
- Search duration: `gateway_metadata.search.search_duration_ms`
- LLM duration: `gateway_metadata.metrics.llm_duration_ms`

Generation tokens per second measures model output speed. Gateway end-to-end throughput is only a fallback and is not presented as the same metric when a provider generation speed is available.

Malformed, negative, non-finite, or incorrectly typed metric values are ignored instead of being displayed as zero.

## Current limitations

Phases 4B and 4C present metadata and coordinate request ownership in Open WebUI. They do not change the Phase 4A Gateway contract, Gateway heuristic, search context prompt, or either search provider.

The Gateway still uses bounded SearXNG snippets rather than full-page extraction. Phase 4B does not verify that every answer claim is supported by its citation and does not make inline `[1]` references clickable.

Mixed-model chats intentionally disable Gateway mode when any selected model lacks the capability. There is no automatic cross-provider search fallback and no restoration of a previous Gateway mode after a provider switch; the safe fallback is `off`.

Usage/API key pages, monitoring redesign, inline citation links, and full-page extraction remain outside these phases.
