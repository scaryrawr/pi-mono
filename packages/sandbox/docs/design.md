# Design notes

## Integration choice

Two approaches fit the initial requirement.

A launcher could start the whole pi process inside MXC. That would cover its file tools and extension code, but pi would need grants for credentials, session files, model networking, and installed extensions. An extension cannot retroactively isolate the process that loaded it.

A tool adapter can sandbox child bash processes through MXC's Node SDK. This matches pi's sandbox example and preserves built-in bash rendering, output truncation, file accumulation, cancellation conventions, and programmatic results. It leaves pi's other tools and integrations outside the sandbox.

This extension uses the tool adapter to restrict bash in a trusted pi installation. It does not isolate the whole agent. A full-agent launcher is separate follow-up work.

## Modules and execution flow

- `extensions/config.ts` owns the TypeBox schema, agent-directory path, parsing, defaults, and atomic writes.
- `extensions/policy.ts` owns memory-only session overrides, effective-policy validation, and explicit persistent mutations.
- `extensions/tools.ts` discovers read-only tool access from the effective PATH without running host commands.
- `extensions/runtime.ts` builds typed MXC V1 requests, implements `BashOperations`, streams output, and disposes native handles.
- `extensions/mxc.ts` registers the bash replacement, user-bash hook, status, and `/sandbox` command.

For an agent bash call, the extension reads and validates saved defaults, applies session overrides, and checks the selected backend. It then creates pi's bash tool definition with MXC operations. Those operations build a request, spawn a native sandbox, and consume both output streams. They wait for the process and streams to finish before disposing the handle. User bash uses the same operations. An explicitly disabled configuration uses pi's local bash behavior.

Config and backend errors fail closed. Native errors do not cause a fallback to local execution. Each command captures its own config. Commands can run in parallel without sharing container handles.

The runtime sets `HOME` to the host home directory so Git can find its global configuration. New defaults grant only `~/.gitconfig` and the standard XDG Git `config`, `ignore`, and `attributes` files. If the host's `XDG_CONFIG_HOME` is valid and absolute, new default environment settings include it so Git looks in the granted location. Otherwise the XDG files use `~/.config/git`. The extension does not expand existing saved policies automatically.

Each execution gets a private writable temporary directory through `TMPDIR`, `TMP`, and `TEMP`. This lets Git and Apple's Git launcher create temporary files without granting access to the host's entire temporary directory. The runtime removes the directory in a `finally` block, including on native launch errors. Separate executions do not share temporary storage.

The runtime also forwards the pi process's PATH and discovers read-only grants for its tool directories, symlink targets, and runtime files. Homebrew needs its installation prefix because executables load dependencies across packages. Discovery follows the current links on every command rather than pinning a version-manager installation. `inheritHostPath: false` disables this behavior for users who want only manual grants. Existing configs omit this optional field and receive tool discovery by default.

Explicitly configured environment values override these defaults. An explicit PATH also replaces the path used for tool discovery. Other environment values come from MXC's default environment. The runtime does not forward pi's session environment or the rest of the host environment. Each request selects a native backend explicitly.

## Why one config

Saved defaults live only in the agent directory. Session commands add memory-only overrides unless the user prefixes the action with `--persist`. Project files cannot override a user's sandbox policy. The parser requires policy fields and rejects unknown keys to catch misspelled restrictions. Commands read the current file before changing it. Invalid policy requires repair instead of a reset to defaults.

A missing file has enabled defaults but is not created on startup. `/sandbox init` owns creation, so merely loading the package does not write user configuration.

## Why session overrides are deltas

A full session snapshot would be simpler to implement, but it would hide later saved restrictions and could save unrelated temporary grants. Instead, the policy module records validated setting changes and filesystem additions or removals. Every read starts from freshly parsed saved defaults. Persistent commands change saved defaults alone, while session overrides remain active until reset.

Session path additions become absolute at grant time. Relative grants must not change meaning when the working directory changes. The default saved `.` grant still follows the command's working directory.

The extension resets overrides on every `session_start`, including reload, new, resume, and fork. It never writes overrides to session entries, so resuming a conversation cannot restore a temporary permission grant. Running commands keep the policy they captured at startup.

## Verification and follow-up

Unit tests cover session isolation, explicit persistence without leaking temporary grants, path anchoring, reset, malformed config, cancellation during spawn, native launch errors, and stream handling through an injectable process implementation. The native integration suite runs real sandboxed processes rather than replacing the SDK with module mocks.

Live verification currently covers macOS Seatbelt only. Linux Bubblewrap and Windows ProcessContainer need host-specific validation. Before adding a full-agent launcher, file-tool sandboxing, or network proxy support, define which operations it restricts and which remain outside its control.
