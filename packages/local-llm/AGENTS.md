# pi-lmstudio-ollama

## Architecture

Single-purpose pi coding agent plugin exposing three local AI providers (Ollama, LM Studio, OMLX) as VS Code extensions. Each extension in `extensions/` follows an identical pattern:

1. Read env vars for base URL and API key (with sensible defaults)
2. Fetch available models from the provider's API
3. Call `pi.registerProvider()` to register each model with the pi agent SDK

There are no tests — this is a small plugin. Focus on correctness, clean code, and matching existing patterns.

## Conventions

- **TypeScript**: strict mode, ES2024, NodeNext module resolution.
- **Naming**: file names are kebab-case (`extensions/ollama.ts`). Function names use PascalCase for types, camelCase for functions.
- **Error handling**: wrap `fetch` calls in `try/catch`, return `undefined` on failure. Extensions silently skip registration if the provider is unavailable.
- **API key defaults**: use low-security placeholder values (`"ollama"`, `"lmstudio"`, `"omlx"`) — matching existing style.
- **Model mapping**: always map provider model metadata to the pi `ProviderModel` interface with `reasoning: false` for Ollama, `reasoning: true` for LM Studio/OMLX (matching current code).
- **Format/lint**: `npm run fmt`, `npm run fmt:check`, `npm run lint`, `npm run lint:fix`. No test command exists.
- **Build**: `npm run build` (tsgo type-check only, no emit).

## Safety

- All providers use local endpoints — no external API calls beyond the local model server.
- API keys from env vars are never logged or exposed to the model.
