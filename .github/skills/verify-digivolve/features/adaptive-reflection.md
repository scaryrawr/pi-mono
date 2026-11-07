# Reflect on durable user corrections

Digivolve starts at most one background review after a genuine qualifying turn settles, and cancels old work when new input arrives.

## Sub-features

- `adaptive-positive` reflects on a repository-specific user correction.
- `adaptive-negative` ignores ordinary successes, ordinary failures, and injected sentinel text.
- `adaptive-single-flight` avoids duplicate or recursive reviews.
- `adaptive-cancel` cancels asynchronous setup and active work on new input or shutdown.

## How to get to it (user POV)

Work normally in a trusted Pi project with automatic reflection enabled. Correct a repo-specific command or recover a qualifying validation-command usage error. Submit a new prompt while reflection is active to cancel it.

## Driving it with Pi RPC

Preconditions: approved authenticated model and a disposable trusted repository. Write `check.py` containing `print("validation-ok")` and seed `AGENTS.md` with `Run python3 old-check.py to validate this repository.` The offline baseline supplies neither a model nor a validation project.

- **Supporting checks.** Run `pnpm --filter @scaryrawr/pi-digivolve exec vitest run extensions/digivolve.test.ts extensions/digivolve/turn-monitor.test.ts`. Capture test output, including side-session startup and cancellation. This does not prove a full model turn.
- **Positive input.** Submit `In this repository, use python3 check.py, not python3 old-check.py. Confirm the validation command works.` as a genuine RPC user prompt. Require normal agent activity to reach `agent_settled` before a reflection pass queues. Capture the correction, actual validation output, and resulting guidance read.
- **Negative control.** Start a new conversation and submit `Run python3 check.py and report its result.` Wait for settlement and require no reflection pass. Repeat with an ordinary test failure without a command-usage correction.
- **Single flight.** Observe one queued reflection per qualifying user message. Confirm no sentinel `<!-- pi-digivolve -->` or reflection result appears in the main conversation history.
- **Cancel.** During background setup or activity, send a new genuine prompt, then shut down the owned instance. Preserve the before and after guidance snapshots and require no delayed writes after cleanup. Verify both setup-time and active-session cancellation separately.

## Gotchas

- `agent_end` is not the settled boundary; retries and continuations may follow.
- Injecting internal tool events or toggling monitor state weakens the user journey and is not accepted as end-to-end proof.
- A recovered ordinary test assertion failure is not automatically durable learning evidence.
- A cancelled review may have already made valid edits. Verify no later writes rather than assuming cancellation rolls back changes.
