# Local LLM verification map

Use a disposable `PI_CODING_AGENT_DIR`; configuration is global to that directory even with a local package installation. Read the [shared driver and evidence contract](../../verification/README.md).

- [Preferences](preferences.md): actual `/local-ai` TUI, navigation, cancellation, save, and restart. The baseline checks cancellation and save without a model server.
- [Discovery](discovery.md): Ollama, Osaurus, LM Studio, OMLX, GenieX, model metadata, and selection.
- [Unavailable providers](unavailable.md): disabled, unreachable, malformed, and slow catalog responses preserve usable Pi startup.

Never drive a shared model-server instance without approval. Real server proof requires a loaded model, not just a health response. Capture each provider separately; one adapter passing does not verify the other four. Creation-time runtime proof is blocked; all entries remain unverified until run.
