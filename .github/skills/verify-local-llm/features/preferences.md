# Choose local providers

Users choose which providers register on the next Pi startup without losing configured server addresses or keys.

## Sub-features

- `preferences-navigation` moves among Ollama, Osaurus, LM Studio, OMLX, and GenieX.
- `preferences-cancel` discards a toggle with Escape.
- `preferences-save` saves toggles with Enter and preserves other settings.
- `preferences-restart` reflects saved selections in a fresh picker and catalog.
- `preferences-rpc` reports that the custom picker requires a TUI.

## How to get to it (user POV)

Run `/local-ai` in the Pi TUI. Use Up and Down to move, Space to toggle, Enter to save, or Escape to cancel. Restart Pi to apply provider registration changes.

## Driving it with a Python PTY

Preconditions: Unix PTY support and usable Pi. The baseline seeds all providers disabled with synthetic keys and unusable loopback addresses.

- **Drive.** Run `./.github/skills/verification/scripts/drive.py local-llm --evidence "$EVIDENCE"`.
- **RPC guard.** Require the RPC `/local-ai` notification `requires interactive TUI mode`.
- **Cancel.** Require the PTY key log to show `/local-ai`, Space on the focused Ollama row, and Escape. Require `cancelled, no changes saved` and byte-for-byte unchanged config.
- **Save.** Reopen `/local-ai`, send Space and Enter. Require the next-start warning and `saved-providers.json` with Ollama enabled, all other providers disabled, and every synthetic address and key preserved.
- **Navigation and restart.** In another owned PTY, send Down to Osaurus, Space, Up to Ollama, then Enter. Close Pi, start a fresh PTY with the same disposable config, and reopen `/local-ai`. Require the visible checkbox states to match the independently read config. Save the navigation and restart transcript separately.

## Gotchas

- RPC `custom()` cannot represent this picker. An RPC-only pass is incomplete.
- The baseline does not restart after saving or exercise arrow navigation. Those sub-features remain unverified until separately driven.
- Toggles affect the next startup, not providers already registered in the current process.
- The fixed row order is verified by the labels in `Local AI providers`. Do not type Space before that menu appears.
