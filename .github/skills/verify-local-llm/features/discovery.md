# Discover and select local models

Enabled providers publish their available models with provider-specific capabilities and limits.

## Sub-features

- `discovery-ollama` reads Ollama tags.
- `discovery-osaurus` reads Osaurus tags.
- `discovery-lmstudio` reads LM Studio model keys and limits.
- `discovery-omlx` includes only LLM and VLM models.
- `discovery-geniex` reads GenieX model IDs and context lengths.
- `discovery-select` selects a discovered model and gets a real response.

## How to get to it (user POV)

Start an approved local model server with a loaded model, enable its provider in `/local-ai`, restart Pi, and select a model. Server addresses and keys are edited in the isolated `pi-local-llm.json`.

## Driving it with Pi RPC and HTTP

Preconditions: own the server or have explicit permission to drive it. Allocate a unique port and data directory when starting one. Configure only the provider under test enabled.

- **Probe the catalog.** Defaults are Ollama `http://localhost:11434/api/tags`, Osaurus `http://localhost:1337/api/tags`, LM Studio `http://localhost:1234/api/v1/models`, OMLX `http://localhost:8000/v1/models/status`, and GenieX `http://127.0.0.1:18181/v1/models`. Use `curl --fail` against the configured equivalent with its approved authentication, never saving keys. Require an actual model entry, not just server health.
- **Start Pi.** Load `packages/local-llm` in an owned RPC process using the shared isolation flags and the dedicated config. Read `get_available_models` after startup. Require the corresponding provider ID `ollama`, `osaurus`, `lmstudio`, `omlx`, or `geniex` and the model IDs from the independent catalog.
- **Check limits.** Compare context and output limits against the observed provider catalog and isolated config. For OMLX, require embedding-only model types absent.
- **Select and infer.** Send `set_model` with an ID returned by that provider, then `{"type":"prompt","message":"Reply exactly with local-verification-ok."}`. Wait for `agent_settled` and require a non-error response with the marker.
- **Supporting adapter checks.** Run `pnpm --filter @scaryrawr/pi-local-llm exec vitest run extensions/providers.test.ts extensions/discovery.test.ts` and preserve output separately.

## Gotchas

- The baseline disables all providers and supplies no model server. It cannot prove this journey.
- LM Studio does not use the same discovery endpoint or JSON shape as Ollama.
- A synthetic HTTP catalog proves adapter projection, not real inference. Label it accordingly.
- `baseUrl` is the server root, without `/v1` or a trailing slash. Discovery still makes explicit HTTP requests even when Pi's automatic networking is disabled.
