# AI Gateway Search Mode (Phase 4A)

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

## Built-in web search

Gateway Web Search and Open WebUI's built-in web search are separate systems. Phase 4A does not change the built-in search toggle or run searches inside Open WebUI. Avoid enabling both for the same request until a double-search policy is defined.

## Current limitations

Phase 4A only sends the requested mode. It does not read or display `gateway_metadata`, resolved mode, sources, citations, search metrics, or token/timing details from the final response chunk.

Phase 4B will add sources and metrics presentation after the response metadata contract is integrated with Open WebUI's stream handling.
