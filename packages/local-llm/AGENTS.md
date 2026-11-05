# Local model providers

## Entrypoints and configuration

The five provider extensions discover models at startup. `extensions/local-ai.ts` owns `/local-ai`; `extensions/config.ts` is an exported helper, not a Pi extension entrypoint. Preserve both default extension exports and named library exports declared in `package.json`.

Use explicit `.ts` relative imports in this package, unlike the rest of the workspace; its tsconfig enables `allowImportingTsExtensions`.

Keep provider settings in `<agentDir>/pi-local-llm.json`, resolved through Pi's `getAgentDir()` and `PI_CODING_AGENT_DIR`. Add settings to the TypeBox boundary schema in `extensions/config.ts` and update `pi-local-llm.example.json`, not provider-specific environment variables.

Providers are enabled unless explicitly disabled. Missing or malformed configuration falls back to defaults. `/local-ai` persists opt-outs for the next startup; toggling a provider must preserve unrelated settings.

## Discovery behavior

Unavailable providers silently skip registration rather than failing Pi startup. Use `extensions/discovery.ts` for schema-validated discovery with a five-second deadline covering headers and body. Preserve provider-specific API shapes and model metadata instead of assuming every server is identical.

Defaults point at local servers, but configured base URLs need not be local. Never log configured API keys or expose them to the model. Keep placeholder API-key defaults and endpoint/context defaults in the corresponding provider module.

Use the root build/lint/format command inventory and `pnpm test:run`. Discovery and provider tests must isolate the agent directory and stub fetch; never read real configuration or contact model servers.
