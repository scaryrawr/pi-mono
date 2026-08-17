# pi-local-llm

## Architecture

Single-purpose pi coding agent plugin exposing four local AI providers (Ollama, LM Studio, OMLX, Osaurus). Each provider extension in `extensions/` follows an identical pattern:

1. Load the provider's opt-in settings from the shared config file via `extensions/config.ts`
2. Return early (no registration) unless the provider is enabled in the config
3. Fetch available models from the provider's API
4. Call `pi.registerProvider()` to register each model with the pi agent SDK

`extensions/local-ai.ts` is the one non-provider extension: it registers the `/local-ai` command, an interactive multi-select list (up/down navigate, space toggle, enter save, esc cancel) for flipping each provider's `enabled` flag in the shared config via `setProviderEnabled()`. Toggles take effect at the next pi start, since providers register at startup.

### Configuration

All settings come from a single JSON config file at `<agentDir>/pi-local-llm.json` (default `~/.pi/agent/pi-local-llm.json`; pi's `getAgentDir()` honors the `PI_CODING_AGENT_DIR` override). There are no env vars for provider settings. Providers are **opt-in**: a provider registers models only when its `enabled` field is explicitly `true`. `pi-local-llm.example.json` shows the full schema. A missing or malformed config file is treated as "no providers configured", so pi always starts cleanly.

There are no tests — this is a small plugin. Focus on correctness, clean code, and matching existing patterns.

## Conventions

- **TypeScript**: strict mode, ES2024, NodeNext module resolution.
- **Naming**: file names are kebab-case (`extensions/ollama.ts`). Function names use PascalCase for types, camelCase for functions.
- **Config**: shared config loading/validation lives in `extensions/config.ts` (`loadProviderConfig()`), plus raw read/save helpers (`readLocalLlmConfigRaw()`, `setProviderEnabled()`) used by the `/local-ai` command. The file is a helper module, not an extension entry. New provider settings go in the config file, never env vars. Invalid config values are dropped silently so extensions fall back to defaults. Relative imports use explicit `.ts` extensions (NodeNext + jiti; see `allowImportingTsExtensions` in tsconfig).
- **Extension exports**: each extension uses both `export default` (for pi harness consumption) and a named export (e.g., `export { ollama }`) so the package is consumable as a library via the `exports` field in `package.json`.
- **Error handling**: wrap `fetch` calls in `try/catch`, return `undefined` on failure. Extensions silently skip registration if the provider is unavailable.
- **API key defaults**: use low-security placeholder values (`"ollama"`, `"lmstudio"`, `"omlx"`, `"osaurus"`) — matching existing style. Base URL and context length defaults are per-provider constants in each extension.
- **Model mapping**: always map provider model metadata to the pi `ProviderModel` interface with `reasoning: false` for Ollama/Osaurus, `reasoning: true` for LM Studio/OMLX (matching current code).
- **Format/lint**: `npm run fmt`, `npm run fmt:check`, `npm run lint`, `npm run lint:fix`. No test command exists.
- **Lint dependencies**: when upgrading `oxlint`, update `oxlint-tsgolint` to satisfy the version declared by `oxlint`'s optional peer dependency; mismatched versions cause npm `ERESOLVE` failures.
- **Build**: `npm run build` (tsgo type-check only, no emit).

## Safety

- All providers use local endpoints — no external API calls beyond the local model server.
- API keys from the config file are never logged or exposed to the model.
