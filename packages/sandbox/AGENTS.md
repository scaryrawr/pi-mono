# Bash sandbox

`extensions/mxc.ts` replaces Pi bash execution and intercepts user bash. It does not sandbox other tools or the whole agent. Keep configuration parsing in `extensions/config.ts`, policy resolution in `extensions/policy.ts`, and backend lifecycle in `extensions/runtime.ts`.

## Execution and policy

When sandboxing is enabled, backend initialization or execution failure must not silently fall back to local bash. Preserve timeout, abort, and disposal behavior for active commands.

Keep session-only changes separate from explicit persistent configuration writes. Resolve each command against its policy snapshot; later toggles must not mutate an in-flight command's grants. Preserve anchored filesystem grants, configuration/auth-file denials, and explicit environment grants.

Consult `README.md` and the package's configuration/design documentation when changing policy or backend behavior.

## Validation

The root test flow runs unit tests, not the native MXC or Pi RPC suites. Run focused `tests/policy.test.ts`, `tests/runtime.test.ts`, `tests/config.test.ts`, or `tests/tools.test.ts` through the root guide's package-local Vitest command.

From this directory, `pnpm test:integration` requires a usable MXC backend, Unix bash, and `/usr/bin/curl`; missing prerequisites fail rather than skip. `pnpm test:rpc` requires Python 3 and installed `pi`, and uses an isolated offline session without model calls. `pnpm test:rpc --commands-only` avoids nested native workloads but still needs Pi and Python.
