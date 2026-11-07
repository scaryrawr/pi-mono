---
name: verify-digivolve
description: Verify pi-digivolve preferences, manual reflection, and adaptive background reflection through isolated Pi RPC sessions. Use after changing reflection triggers, cancellation, or persistence.
---

# Verify Digivolve

Draft: creation-time Pi startup was blocked by filesystem permissions. Read [shared setup and proof rules](../verification/README.md) and the [feature index](features/README.md).

## Launch

From the repository root, run `pnpm install --frozen-lockfile`, then `pnpm --filter @scaryrawr/pi-digivolve build`.

```sh
EVIDENCE="$PWD/.cache/verification/digivolve-$(date +%Y%m%dT%H%M%S)-$$"
./.github/skills/verification/scripts/drive.py digivolve --evidence "$EVIDENCE"
```

The baseline loads the package in an empty, untrusted scratch workspace and isolated agent directory. It makes no model calls. Ready means `get_state` is idle and `get_commands` includes `digivolve`. Live reflection needs a separately approved synthetic trusted repository, active authenticated model, and conversation. Never use the real checkout as the reflection target.

## Doctor

Run the driver's `pi --version`, `get_state`, `get_commands`, and `/digivolve status` checks. Require status to name the temporary `pi-digivolve.json` path. For reflection, inspect the active model and trust decision as well. A queued notification does not prove the side session started or finished.

## Drive

The baseline runs [preferences](features/preferences.md): disable, read saved JSON, restart Pi, check status, re-enable, and verify preference commands did not enter conversation history. [Manual reflection](features/manual-reflection.md) covers the skip conditions and authorized `/digivolve` and `force` paths. [Adaptive reflection](features/adaptive-reflection.md) requires real user input and settled model activity, including a negative control and cancellation.

## Evidence

Capture input commands, transient notifications, configuration reads, fresh-process status, and main conversation history. Reflection proof also captures the synthetic guidance diff, background completion or cancellation, and an unchanged main message history. Files need not change if the agent correctly finds no durable lesson. A green unit test or injected `agent_settled` event does not prove a genuine user turn triggers reflection at the right time.

Reflection has write-capable tools and can load other installed extensions. No dry-run exists. Use a disposable repository with synthetic conversation content. Do not copy a private conversation or real repository guidance into evidence.

## Cleanup

Shutdown must cancel and await background setup or work. The baseline closes each owned Pi process before removing scratch state and preserves `$EVIDENCE`. Require `scratchRemoved: true` in `result.json`. Live runs need the same orderly shutdown and an independent check that no later guidance write occurred. Never kill a shared Pi session.

## Helpers

Use the executable shared driver above and `controlled_session` from [verification support](../verification/README.md). Use `/maintain-verification-skill` after changing reflection behavior or shipped skills.
