# pi-digivolve

`@scaryrawr/pi-digivolve` is a Pi package that ports the Digivolution idea from
the Copilot CLI plugin to Pi.

It helps agents leave a repository easier for the next agent to work in. When
the agent settles, it may start an ephemeral, in-memory side session seeded
with the main conversation history. Automatic reflection runs only when the
current user turn contains strong evidence of a durable repository learning
opportunity. The side session runs in the background and may decide no change
is warranted.

## What it updates

The extension does not directly edit files. Its reflection agent can use `read`,
`bash`, `edit`, and `write` to review the session and, only when useful, edit the
narrowest appropriate guidance surface:

- `AGENTS.md`
- `.pi/skills/**/SKILL.md`
- `.agents/skills/**/SKILL.md`
- Existing cross-agent files such as `CLAUDE.md`,
  `.github/copilot-instructions.md`, or `.github/instructions/*.instructions.md`
  when the repo intentionally uses them.

Reflection is not read-only or sandboxed: its tools and loaded extensions run
with Pi's permissions. Review resulting guidance changes before committing.

## How it works

- `input`: each genuine user prompt (`interactive` or `rpc`) starts a fresh
  in-memory turn monitor. Extension input and the reflection sentinel never
  re-arm reflection.
- `tool_result`: failed and successful local `bash` validation operations are
  correlated using command hashes and minimized repo-local targets.
- `agent_settled`: after automatic retries, compaction retries, and queued
  continuations finish, reflection starts only if the turn has qualifying evidence.

Automatic reflection may run when:

- The user directly corrects a repository-specific command, instruction, setup
  step, convention, or workflow.
- A repo-local validation operation fails repeatedly and a materially changed
  operation against the same target succeeds.
- A command usage error is recovered by a materially changed validation command
  against the same repo-local target.

It does not trigger for ordinary test failures, long turns, repeated edits,
generic frustration, network failures, or successful validation alone. Prompts,
commands, tool output, and errors are inspected only in memory. Failed commands
are retained only as hashes plus minimized categories and targets.

Reflection runs at most once per user message. A new genuine prompt cancels any
in-flight reflection, including asynchronous setup, before monitoring the new
turn. Shutdown also cancels it. Reflection requires a trusted project and uses
the active coding session's model and thinking level.

The side session uses `SessionManager.inMemory(cwd)` and `buildSessionContext`
to snapshot the main conversation. An explicitly initialized
`DefaultResourceLoader` provides project skills and prompts and preserves other
extensions, including model providers. The side session binds extensions before
prompting and emits `session_shutdown` before disposal, including on cancellation.
It filters out the extension registering
`digivolve`, regardless of installation path or package name, to prevent
recursive reflection sessions.

Results are transient `ctx.ui.notify` notifications, never messages in the main
conversation. The main agent therefore cannot be influenced by its own prior
reflection output on subsequent turns.

Automatic reflection is enabled by default. `/digivolve off` and `/digivolve on`
persist the setting in `pi-digivolve.json` under Pi's user config directory.
Manual reflection remains available without automatic evidence.

## Commands

| Command             | Effect                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `/digivolve`        | Run reflection now and mark this message handled.                                                         |
| `/digivolve force`  | Run reflection even if it already ran for this message; still respects trust and the single-flight guard. |
| `/digivolve status` | Show enabled state, current message/evidence state, and config path.                                      |
| `/digivolve on`     | Enable automatic reflection and persist the setting.                                                      |
| `/digivolve off`    | Disable automatic reflection and persist the setting.                                                     |

## Install from a checkout

From the monorepo root, install dependencies with `pnpm install --frozen-lockfile`,
then point Pi at this package:

```sh
pi install /absolute/path/to/pi-mono/packages/digivolve
```

Remove the old standalone `pi-digivolve` installation before enabling this one to
avoid duplicate hooks and commands. Existing `pi-digivolve.json` settings are
reused. The extension entrypoint, `/digivolve` command, and bundled skill name
remain unchanged.

From this package directory, test the extension alone with:

```sh
pi -e ./extensions/digivolve.ts
```

Use `pi -e .` to load both the extension and the bundled
`skills/digivolution/SKILL.md` skill.

## Development

From the monorepo root:

```sh
pnpm --filter @scaryrawr/pi-digivolve build
pnpm --filter @scaryrawr/pi-digivolve lint
pnpm --filter @scaryrawr/pi-digivolve fmt:check
pnpm --filter @scaryrawr/pi-digivolve test:run
```

Build type-checks with tsrs without emitting JavaScript. Tests cover adaptive
turn evidence, one-reflection-per-message behavior, and Pi's package discovery
of the extension and skill, plus side-session extension startup, resource
discovery, shutdown, and cancellation without model calls.
Use `pnpm --filter @scaryrawr/pi-digivolve pack --out <temporary-directory>/digivolve.tgz` to
check the published files and catalog resolution.

## Migration source

Imported from [scaryrawr/pi-digivolve](https://github.com/scaryrawr/pi-digivolve)
at commit `cb2b0afcb723ac50ac9d116aa9ef232762cbf666` as a source snapshot.
The original git history has not yet been imported. The standalone npm lockfile,
vendored lint tooling, and root ignore/formatter/linter configs are replaced by
the monorepo's shared tooling. Runtime reflection behavior is unchanged.
