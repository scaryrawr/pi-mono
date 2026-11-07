# Configure automatic reflection

Users check, disable, or enable automatic reflection, and their choice survives a new Pi process without adding conversation messages.

## Sub-features

- `preferences-default` starts enabled without writing a config.
- `preferences-off` saves automatic reflection disabled.
- `preferences-on` saves automatic reflection enabled.
- `preferences-status` reports the active preference and isolated config path.

## How to get to it (user POV)

Run `/digivolve status`, `/digivolve off`, or `/digivolve on` in Pi. Restart Pi to confirm the saved choice.

## Driving it with Pi RPC

Preconditions: the offline baseline starts in an empty scratch agent directory and needs no authenticated model.

- **Drive.** Run `./.github/skills/verification/scripts/drive.py digivolve --evidence "$EVIDENCE"`.
- **Disable.** Require `/digivolve off` notification and `disabled.json` with `enabled: false`. Require `/digivolve status` to report `auto=off` and the scratch config path.
- **Restart.** Require `restart.jsonl` to show a second owned Pi process reporting `auto=off` before enabling. A read from the original in-memory config is insufficient.
- **Enable.** Require `/digivolve on` notification and the driver's independent disk read of `enabled: true`.
- **Conversation isolation.** Require `get_messages` to return an empty message list after these commands.

## Gotchas

- Disabling automatic reflection does not disable manual `/digivolve`.
- Config lives in the Pi agent directory as `pi-digivolve.json`, not the repository.
- Preferences alone do not prove reflection, cancellation, or guidance edits.
- Status notifications are transient UI output, not conversation messages.
