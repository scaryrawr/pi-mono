# Change sandbox policy scope

Users temporarily change policy, explicitly persist defaults, or reset session overrides without unintentionally saving unrelated grants.

## Sub-features

- `policy-session` keeps ordinary commands session-only.
- `policy-init` creates enabled defaults without copying session overrides.
- `policy-persist` saves only the explicitly requested change.
- `policy-reset` clears overrides on reset or new session.

## How to get to it (user POV)

Run `/sandbox status`, `off`, `on`, `init`, `reset`, or `add readonly`. Put `--persist` before an action to save it. Use `/sandbox path` to locate the isolated config.

## Driving it with Pi RPC

Preconditions: the offline baseline needs Pi but no native backend workload or model account.

- **Baseline.** Run `./.github/skills/verification/scripts/drive.py sandbox --evidence "$EVIDENCE"`. Require session `enabled: false` after `/sandbox off` and no config file until initialization. Require `saved-policy.json` enabled and effective policy enabled after `new_session`.
- **Explicit persistence.** In `controlled_session("sandbox", ".cache/verification/sandbox-persistence")`, call `/sandbox init`, `/sandbox add readwrite /session-only-access`, then `/sandbox --persist add readonly /saved-access`. Read `agent / "pi-mxc.json"`. Require only `/saved-access` persisted and the session grant still effective but absent from disk.
- **Reset.** Call `/sandbox reset`, then `/sandbox status`. Require the session-only grant absent and the saved grant present.
- **Network scope.** Call `/sandbox network allow`, read effective policy and saved JSON, then `/sandbox reset`. Require temporary egress allow did not persist and reset restores deny. This changes policy only; it does not test actual connectivity.
- **Full command suite.** Run `pnpm --filter @scaryrawr/pi-mxc test:rpc --commands-only` for the existing extended command journey. Save output and exit code.

## Gotchas

- `--persist` goes before the action. It does not save unrelated session overrides.
- The extended commands-only suite includes local bash opt-out execution. It is not read-only.
- Saved defaults are global to the isolated agent directory, with no project weakening override.
- Policy output is not proof that a backend enforces it.
