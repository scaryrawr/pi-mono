---
name: verify-local-llm
description: Verify pi-local-llm provider preferences in a real Pi TUI and model discovery through isolated RPC sessions. Use after changing local-ai, configuration, or provider adapters.
---

# Verify local LLM providers

Draft: creation-time Pi startup was blocked by filesystem permissions. Read [shared setup and proof rules](../verification/README.md) and the [feature index](features/README.md).

## Launch

From the repository root, run `pnpm install --frozen-lockfile`, then `pnpm --filter @scaryrawr/pi-local-llm build`. The baseline needs Unix Python PTY support, not a model server.

```sh
EVIDENCE="$PWD/.cache/verification/local-llm-$(date +%Y%m%dT%H%M%S)-$$"
./.github/skills/verification/scripts/drive.py local-llm --evidence "$EVIDENCE"
```

The driver seeds all five providers disabled, with synthetic keys and loopback port 1 addresses. It first checks RPC mode, then opens a 120-column PTY with the package's six declared entrypoints. Ready means `/local-ai` displays `Local AI providers`; the startup banner alone is not proof that the picker works. Pi and any live model servers must be separate owned instances.

## Doctor

Check `version.txt`, `doctor.json`, and `local-ai` registration. In RPC, `/local-ai` must warn `requires interactive TUI mode`. Custom TUI components cannot be controlled over RPC. For discovery, read the isolated config, probe the provider-specific catalog endpoint, and confirm a loaded model before starting Pi.

## Drive

The baseline runs [preferences](features/preferences.md) with actual Space, Escape, and Enter keys. It verifies cancellation and saved JSON while preserving server settings. [Discovery](features/discovery.md) covers all five providers, their distinct endpoints, and model selection. [Unavailable providers](features/unavailable.md) covers disabled and unreachable servers without weakening startup checks.

## Evidence

Save raw terminal output and key actions together, resulting config, and fresh-process model catalogs for restart-dependent claims. Reopen the picker for persistence claims. The baseline proves preference save and cancellation only; it does not verify discovery or inference. Synthetic loopback port 1 is a deliberately unusable address, not a model-server substitute. Discovery fixtures may exercise the production HTTP boundary but do not prove a real model can answer.

Never read the user's shared `pi-local-llm.json` or log real API keys. Do not install servers, download models, or drive an already-running model server without approval.

## Cleanup

The driver shuts down its own RPC and PTY children and deletes only temporary settings. It does not stop model servers. Preserve `$EVIDENCE` and require `scratchRemoved: true` in `result.json`. Additional live servers require unique ports and data directories, plus teardown using their recorded process handles.

## Helpers

Use the executable shared driver above; its PTY routine is `preferences_pty`. Use `controlled_session` for extra RPC journeys as documented in [verification support](../verification/README.md). Use `/maintain-verification-skill` after UI or adapter changes.
