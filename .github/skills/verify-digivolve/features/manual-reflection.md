# Request reflection manually

Users ask Digivolve to review a conversation now, with trust and single-flight safeguards and transient results.

## Sub-features

- `manual-untrusted` skips in untrusted projects.
- `manual-empty` skips without conversation content.
- `manual-run` reviews a genuine conversation.
- `manual-force` permits another review while still preventing overlapping work.

## How to get to it (user POV)

Run `/digivolve` or `/digivolve force` after a conversation. Use `/digivolve status` to inspect the current-message state.

## Driving it with Pi RPC

Preconditions: skip checks need no model. Positive reflection needs a disposable trusted repository, active authenticated model, and synthetic user conversation.

- **Untrusted skip.** In `controlled_session("digivolve", ".cache/verification/digivolve-untrusted")`, call `client.command("/digivolve")`. Require `project is not trusted`, no guidance writes, and no added messages.
- **Empty skip.** In `controlled_session("digivolve", ".cache/verification/digivolve-empty", approve=True)`, call `/digivolve`. Require `no conversation to reflect on yet` and no guidance writes.
- **Live run.** In an approved scratch repository, write `check.py` containing `print("validation-ok")` and `AGENTS.md` containing `Run python3 old-check.py to validate this repository.` Submit `In this repository, use python3 check.py, not python3 old-check.py. Confirm the validation command works.` as a genuine user prompt. Wait for settlement, then call `/digivolve`. Capture whether automatic reflection already consumed that message. If it did, require the already-ran notification and use `/digivolve force` for the manual path.
- **Completion.** Independently read the scratch guidance diff and main `get_messages` before and after reflection. Require no reflection-result message in the main history. A no-change result can be valid only after the review actually completes.
- **Force.** Request `/digivolve force` again after completion. Require at most one active side session. Record a queued pass and its completion or cancellation, not only the queue notification.

## Gotchas

- The offline baseline intentionally lacks trust, model credentials, and conversation. It cannot prove positive reflection.
- Reflection may finish silently. Queue acceptance alone is not completion evidence.
- Force bypasses the per-message consumed state, not project trust or the single-flight guard.
- Reflection can edit files and execute host tools. There is no safe dry-run switch.
