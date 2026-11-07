# Sandbox verification map

Use only disposable policies and filesystem fixtures. Read the [shared driver and evidence contract](../../verification/README.md).

- [Policy](policy.md): session overrides, saved defaults, explicit persistence, reset, and session switch. The baseline needs no native execution.
- [Editor](editor.md): RPC JSON editing, cancel, validation, and scope.
- [Execution](execution.md): native bash, user bang commands, tool bash, denial, network, timeouts, and aborts.

MXC protects bash only. `--commands-only` skips nested native checks but still runs local bash when opted out. Record the backend and distinguish policy-command proof from enforcement proof. An unavailable backend is a failure, never a skipped pass. Creation-time runtime proof is blocked; all entries remain unverified until run.
