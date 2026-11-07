# Select cached Copilot models

Users see account-model metadata without waiting for discovery and can select a projected model in Pi.

## Sub-features

- `cache-warm` loads a fresh on-disk model cache at startup.
- `cache-limits` projects context and output limits.
- `cache-select` selects the projected model in the current session.

## How to get to it (user POV)

Start Pi with the Copilot extension and an existing fresh cache. Select the model in Pi's model picker, or use the equivalent RPC `set_model` command.

## Driving it with Pi RPC

Preconditions: the shared driver creates a fresh synthetic cache with `verify-cache-model`, tool-call support, an 8192-token context, and a 1024-token output limit. No credentials or inference are required.

- **Launch.** Run `./.github/skills/verification/scripts/drive.py copilot --evidence "$EVIDENCE"`.
- **Inspect catalog.** Require `models.json` to contain `provider: github-copilot`, `id: verify-cache-model`, `contextWindow: 8192`, and `maxTokens: 1024`.
- **Select.** The transcript must show `{"type":"set_model","provider":"github-copilot","modelId":"verify-cache-model"}`, then `get_state` with that selected ID.
- **Observe startup.** Preserve the idle doctor response and successful exit alongside the synthetic cache seed. A fallback-only catalog fails the cache journey.

## Gotchas

- The cache expires after 24 hours. Seed `cachedAt` at run time, not with a checked-in date.
- This model ID is synthetic. Sending inference to it is not a valid test.
- RPC selection does not prove TUI picker rendering. Capture a separate PTY picker action when that path changes.
- Do not save raw cache files from real accounts as evidence.
