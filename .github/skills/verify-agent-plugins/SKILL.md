---
name: verify-agent-plugins
description: Verify pi-agent-plugins discovery, marketplace UI, native MCP, and hooks through isolated Pi RPC sessions. Use after changing plugin loading, trust, or lifecycle behavior.
---

# Verify Agent Plugins

Draft: creation-time Pi startup was blocked by filesystem permissions. Do not report runtime verification until this workflow passes. Read [shared setup and proof rules](../verification/README.md) and the [feature index](features/README.md).

## Launch

From the repository root, run `pnpm install --frozen-lockfile`, then `pnpm --filter @scaryrawr/pi-agent-plugins build`.

```sh
EVIDENCE="$PWD/.cache/verification/agent-plugins-$(date +%Y%m%dT%H%M%S)-$$"
./.github/skills/verification/scripts/drive.py agent-plugins --evidence "$EVIDENCE"
```

The driver creates a synthetic direct plugin with a portable skill and a Pi prompt, and writes only its disposable global `pi-agent-plugins.json`. It loads the package plus Pi's built-in MCP and tool-search extensions. Ready means `get_state` reports idle and `get_commands` includes `marketplaces`, `skill:verify-demo`, and `verify-prompt`. A successful process spawn alone is insufficient.

## Doctor

The driver checks `pi --version`, `get_state`, and `get_commands` against the owned process. Inspect `version.txt`, `doctor.json`, and `drive.stderr.txt` when resources are missing. Require Pi >=0.99.1 for native MCP and verify loaded resource paths refer to this run's synthetic plugin. Do not inspect the user's plugin directories.

## Drive

The baseline drives [resource discovery](features/resources.md). Use `controlled_session` for the [marketplace UI](features/marketplaces.md). Run the existing real-session [MCP and hook integrations](features/mcp-hooks.md) separately. Direct discovery does not verify marketplace toggling, trusted project configuration, or hook decisions.

## Evidence

Preserve the config seed, resource names and paths, RPC transcript, errors, and exit status. Marketplace proof also needs the saved global config and resource discovery after restart. MCP proof requires deferred search and a real subprocess tool result. Hook proof requires the attempted action, decision, and absence or presence of its side effect. Existing hook-event integration checks are supporting evidence, not proof that a denied user action could not execute.

Use synthetic local plugins only. Hooks and MCP subprocesses execute with host permissions. Do not enable a real marketplace for verification or claim this loader sandboxes it. GitHub clone and refresh paths need separate network-authorized coverage.

## Cleanup

The driver closes its own Pi process and removes its temporary agent and workspace directories. Integration tests emit `session_shutdown` before session disposal. Keep `$EVIDENCE`; inspect `result.json` for `scratchRemoved: true` after failure as well as success. Do not remove a user's persistent `plugin-data`.

## Helpers

The executable shared driver and `controlled_session` API are documented in [verification support](../verification/README.md). Use `/maintain-verification-skill` to keep this map aligned with plugin formats and Pi commands.
