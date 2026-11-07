# Package verification support

The six `verify-*` skills own their package's journeys. This directory contains shared drivers, not a seventh skill. Read the relevant feature index before a run.

## Status

These skills are drafts until their own launch, doctor, mapped journey, and cleanup pass on a usable host. The creation environment denied access to the pnpm package-manager store lock and the installed Pi package. Copilot CLI also failed to extract into its cache. Python checks do not replace Pi runtime proof.

## Prepare the checkout

Run from the repository root with Node >=24 and pnpm 12.16.1, as pinned in `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm build
```

Do not change dependency versions or bypass filesystem restrictions to make a verification run pass. Report the failed command and diagnostic if preparation fails. TypeScript entrypoints run directly in Pi; build only type-checks.

## Run one baseline journey

```sh
EVIDENCE="$PWD/.cache/verification/$(date +%Y%m%dT%H%M%S)-$$"
./.github/skills/verification/scripts/drive.py digivolve --evidence "$EVIDENCE"
```

The driver requires a new evidence directory. It creates an isolated temporary workspace and agent directory, seeds synthetic configuration, starts only the requested package, checks Pi, drives one journey, and closes the child. No instance or configuration from the user's active session is reused. It removes scratch state on success and failure. `result.json` records the feature ID, result, and whether scratch state was removed. An exit code of zero proves only that named journey.

The driver uses `pi --no-session --no-extensions --no-skills --no-prompt-templates --no-context-files --no-approve`, then `-e` with the resolved package directory, `--offline`, and `--mode rpc`. Agent Plugins additionally loads `builtin:mcp` and `builtin:tool-search`. Local-llm also starts a Unix PTY for its custom picker. Webfetch omits `--offline`, requires an explicit model, and declares only `webfetch` to that model.

`--offline` prevents Pi's automatic network activity. It is not a network sandbox and does not suppress arbitrary extension requests or explicit model prompts. Offline baselines strip inherited Pi settings and token, API-key, and secret environment variables. Local-llm seeds all providers disabled. Copilot uses a synthetic cache without OAuth. No baseline tests the absence of every possible network operation.

## Drive additional RPC journeys

Use the public driver functions in a Python process. `controlled_session` yields `(client, agent, workspace)`, runs doctor, and always closes Pi and removes scratch state. Its default seed is the same as the baseline. Set `approve=True` only for a synthetic workspace whose project configuration the journey must trust.

```sh
PYTHONPATH="$PWD/.github/skills/verification/scripts" python3 - <<'PY'
from drive import controlled_session, require
with controlled_session("digivolve", ".cache/verification/digivolve-status") as (client, agent, workspace):
    require("auto=on" in client.command("/digivolve status"), "Default is not enabled")
PY
```

For a fresh process using the same scratch config, call `client.restart("restart")`, then run `doctor(client, "digivolve", evidence)` with the package under test. Use a different log label for each restart. For startup-specific fixtures, pass `prepare=prepare` to `controlled_session`; the callback receives `(agent, workspace)` after the default seed but before Pi starts. Write only synthetic files in that callback.

`client.request({"type": "get_state"})` returns `(data, notifications)`. `client.command("/digivolve status")` requires a handled extension command and returns notification text. Both capture requests, responses, and events in `drive.jsonl`. Failed responses, closed stdout, and deadlines fail the run.

For sandbox session-editor cancellation, pass `dialogs=[{"method": "editor", "title": "MXC bash sandbox policy (session only)", "cancelled": True}]`. Other recipes must use the exact emitted method and title. Matching replies use Pi's request ID. Unexpected dialogs are cancelled and fail the run. The driver does not implement built-in TUI commands such as `/reload` or `/login` over RPC. Restart the owned process or use a real PTY for those paths.

## Capture proof

Preserve the action and result together:

- RPC commands, model tool calls, results, notifications, and exit status.
- Raw PTY bytes and a separate key-action log for custom TUI interactions.
- Independent reads of written configuration and a fresh process when persistence is the claim.
- HTTP request logs and tool-result content for webfetch.
- Filesystem, environment, exit-code, and network observations for native sandbox enforcement.

Use real commands, tool execution, and transport boundaries. Do not mark an emitted internal event, direct setter, mocked response, or final screenshot as proof of the complete user path. Synthetic cached model data proves cache projection, not GitHub access. Local HTTP fixtures are permitted at webfetch's production HTTP boundary; they do not prove public DNS, TLS, redirects, or a remote site's behavior. Existing unit suites are supporting evidence unless the feature explicitly identifies a real integration path.

Do not capture `auth.json`, raw Copilot cache or model-store contents from a real account, API keys, or arbitrary home-directory files. The driver saves only its synthetic settings. Live transcripts can still contain private data; use a dedicated verification account and review artifacts before sharing them.

## Cleanup and evidence survival

The driver closes stdin for orderly RPC shutdown, waits, and kills only its own `Popen` child if shutdown times out. PTY cleanup signals only its own child. It shuts down its own loopback HTTP server. Temporary-directory cleanup never deletes evidence.

After every attempt, including a failed startup, inspect:

```sh
python3 - "$EVIDENCE" <<'PY'
import json, pathlib, sys
root = pathlib.Path(sys.argv[1])
result = json.loads((root / "result.json").read_text())
assert result["scratchRemoved"], result
assert (root / "version.txt").exists()
print(result)
PY
```

For additional `controlled_session` journeys, inspect `cleanup.json` after success or failure. If a recipe launches a separate process, keep its handle and close it in `finally`. Never use `pkill`, `killall`, or a shared terminal session. Never remove `.cache/verification` during teardown.

Use `/maintain-verification-skill` to update the package feature maps as behavior changes.
