---
name: verify-sandbox
description: Verify pi-mxc sandbox policy commands through isolated Pi RPC and bash enforcement on a real MXC backend. Use after changing policy, persistence, execution, or cleanup.
---

# Verify the bash sandbox

Draft: creation-time Pi startup was blocked by filesystem permissions. Read [shared setup and proof rules](../verification/README.md) and the [feature index](features/README.md).

## Launch

From the repository root, run `pnpm install --frozen-lockfile`, then `pnpm --filter @scaryrawr/pi-mxc build`.

```sh
EVIDENCE="$PWD/.cache/verification/sandbox-$(date +%Y%m%dT%H%M%S)-$$"
./.github/skills/verification/scripts/drive.py sandbox --evidence "$EVIDENCE"
```

This command verifies policy without nested native workloads. It uses an empty workspace and agent directory, with no model calls. Ready means `get_state` is idle and `get_commands` includes `sandbox`. Enforcement needs a usable MXC backend, Unix bash, and `/usr/bin/curl`. See [host requirements](../../../packages/sandbox/README.md#host-requirements). Backend discovery is not proof that native execution works.

## Doctor

Check `version.txt`, `doctor.json`, `/sandbox status`, and `/sandbox path` against this run's temporary agent directory. For enforcement, run a harmless bash command through the owned Pi instance and require its expected output. Native launch failure is a failed prerequisite, not a reason to turn sandboxing off or use local bash as proof.

## Drive

The baseline runs [policy scope](features/policy.md): session-only off, initialization of enabled saved defaults, and session-switch reset. [Editor](features/editor.md) uses actual RPC editor requests, including cancellation and malformed JSON. [Execution](features/execution.md) uses the existing CLI RPC and native integration suites. `--commands-only` skips native workloads and still executes a local opt-out command. It is not a dry-run or evidence of enforcement.

## Evidence

Preserve commands, effective policy, saved JSON, reset state, RPC transcript, and exit status. Enforcement proof must include allowed and denied file operations, independently observed files, environment isolation, network outcomes, and timeout or abort completion. A blocked model-tool path does not prove interactive user bash is blocked; verify both where the map requires them.

This package sandboxes bash only. Pi's other tools, model traffic, hooks, and MCP remain outside MXC. Never call this whole-agent isolation. Run native verification in a disposable workspace, never with private files or an unrestricted persistent network grant.

## Cleanup

The driver closes its owned process and removes temporary configuration. Existing RPC tests close their child in `finally`; integration tests dispose runtimes. Preserve `$EVIDENCE` and require `scratchRemoved: true` in `result.json`. Stop only recorded processes and servers. Never remove user sandbox defaults or broad filesystem paths.

## Helpers

Use the executable shared driver above. Existing `packages/sandbox/tests/verify-rpc.py` is invoked with Python through `pnpm test:rpc`; its invocation is listed in [execution](features/execution.md). Use `/maintain-verification-skill` when policy commands or backend requirements change.
