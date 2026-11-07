---
name: verify-copilot
description: Verify pi-copilot cached models, catalog fallback, and account-specific model selection through isolated Pi RPC and live provider sessions. Use after changing discovery or model projection.
---

# Verify Copilot

Draft: creation-time Pi startup was blocked by filesystem permissions. Read [shared setup and proof rules](../verification/README.md) and the [feature index](features/README.md).

## Launch

From the repository root, run `pnpm install --frozen-lockfile`, then `pnpm --filter @scaryrawr/pi-copilot build`.

```sh
EVIDENCE="$PWD/.cache/verification/copilot-$(date +%Y%m%dT%H%M%S)-$$"
./.github/skills/verification/scripts/drive.py copilot --evidence "$EVIDENCE"
```

The driver starts offline in a disposable agent directory with a fresh synthetic `copilot-models.json`, no OAuth, and one tool-capable `verify-cache-model`. No login is required. Ready means the owned Pi process is idle and `get_available_models` includes that model under `github-copilot`. Pi owns real OAuth, not this extension.

## Doctor

Check `version.txt`, `doctor.json`, and the `get_available_models` response in `drive.jsonl`. A curated catalog alone does not prove the extension loaded its cache. For live coverage, use a dedicated verification agent directory and `pi auth check --provider github-copilot --json --no-refresh` there. Do not use `--credentials` or credential-printing commands. The live doctor must use the same isolated account and extension as the drive.

## Drive

The baseline runs [cached selection](features/cached-models.md), checking limits and `set_model` followed by `get_state`. Run [fallback](features/fallback.md) without a usable cache. [Live discovery and inference](features/live-models.md) requires approved account credentials and network access. A synthetic cache model cannot answer a prompt and is never used for inference.

## Evidence

Capture model IDs and safe capability metadata, selection commands, resulting state, errors, and process exit. For live discovery, independently compare the offered catalog with account policy and verify a real model response. Do not log real `auth.json`, `copilot-models.json`, or `models-store.json` contents. The synthetic cache journey proves projection only, not endpoint compatibility, OAuth refresh, or GitHub reachability. `--offline` is not a guarantee that arbitrary extensions cannot access the network.

## Cleanup

The driver closes its owned process and deletes its synthetic cache and temporary directories. Evidence survives at `$EVIDENCE`; require `scratchRemoved: true` in `result.json`. For dedicated live accounts, close only the process started by the run and remove only the credential copy approved for that run. Never edit or delete the user's auth store.

## Helpers

Use the executable shared driver above and `controlled_session` from [verification support](../verification/README.md). Use `/maintain-verification-skill` after catalog or provider-lifecycle changes.
