# Digivolve guide

## Structure

`extensions/digivolve.ts` registers lifecycle hooks and `/digivolve`.
`extensions/digivolve/config.ts` persists the enabled setting in Pi's user directory
as `pi-digivolve.json`; keep this filename compatible with existing installs.
`extensions/digivolve/turn-monitor.ts` collects minimized, in-memory evidence.
`skills/digivolution/SKILL.md` ships with the package. Keep reflection prompts,
skill guidance, and README behavior descriptions aligned.

## Reflection invariants

- The ephemeral session may load other extensions, including model providers,
  but must filter out the extension registering `digivolve`. This command-based
  identity must work for both the old unscoped and new scoped package name and
  for local, npm, git, and symlinked installs.
- Return results only through transient UI notifications, never through
  `pi.sendMessage()` or `pi.sendUserMessage()` or conversation history.
- Arm only from genuine `input` sources (`interactive` or `rpc`), never from
  message roles or `message_start`. Preserve the `<!-- pi-digivolve -->` sentinel
  and single-flight guard as defense in depth.
- Consume automatic reflection at most once per user message, and only with
  strong evidence: a repository-specific user correction, a recovered validation
  command usage mistake, or repeated failed repo-local validation followed by a
  materially changed successful command against the same target. Ordinary
  failures and successful validation alone must not trigger reflection.
- Start automatic reflection only from `agent_settled`, not tool events or
  `agent_end`, after retries, compaction, and queued continuations are exhausted.
- Cancellation covers asynchronous resource/session creation, not just an
  existing `AgentSession`. Mark the owning task cancelled, await cleanup, and
  allow only that task to release its guard so stale setup cannot overlap a new
  reflection or clear its guard.
- Bind the side session's extensions before prompting and emit `session_shutdown`
  before disposal, including when cancellation occurs during startup.
- Reflection uses the active coding session's model and runs only in trusted
  projects. Do not retain raw prompts, commands, output, or errors in monitor state.

## Validation

Use the root workspace tooling; do not restore standalone npm lockfiles or
package-local formatter/linter configuration. Relative imports use `.js`.
Run `pnpm build`, `pnpm lint`, `pnpm fmt:check`, and `pnpm test:run` from this
package. Use `pnpm pack --out <temporary-directory>/digivolve.tgz` to inspect shipping contents.
For manual testing, `pi -e ./extensions/digivolve.ts` loads the extension alone;
`pi -e .` also loads the bundled skill. Lifecycle and cancellation changes need
manual Pi testing as well as the turn-monitor unit tests.
