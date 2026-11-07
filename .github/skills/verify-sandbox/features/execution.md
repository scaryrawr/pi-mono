# Enforce bash restrictions

Users and model tool calls run bash under MXC while explicit local opt-out remains visible and deliberate.

## Sub-features

- `execution-user` applies policy to RPC bash and TUI `!` and `!!`.
- `execution-tool` applies policy to the agent's bash tool.
- `execution-files` permits workspace writes and denies escape writes.
- `execution-network` enforces networking and environment restrictions.
- `execution-cancel` handles timeouts, aborts, and disposal without fallback.

## How to get to it (user POV)

Leave sandboxing enabled and ask the agent to run bash, use `!` or `!!` in the Pi TUI, or send an RPC `bash` command. Use `/sandbox off` only to explicitly run locally for that session.

## Driving it with Pi RPC and MXC

Preconditions: supported native MXC host, Unix bash, `/usr/bin/curl`, Python, and installed Pi. Never substitute local execution for a failed native backend.

- **CLI and native user bash.** Run `pnpm --filter @scaryrawr/pi-mxc test:rpc`. Require `rpc-sandbox-ok`, a denied `../escape.txt` write with no file, explicit local opt-out writing `../local.txt`, and reset restoring restrictions. The script uses its own temporary directories and closes Pi in `finally`.
- **Native integration.** Run `pnpm --filter @scaryrawr/pi-mxc test:integration`. Capture platform/backend, command, output, and exit status. Require the real filesystem, symlink, tool runtime, Git, environment, network, exit-code, timeout, and cancellation checks to pass.
- **TUI user commands.** In an owned PTY with the same disposable policy, send `!printf tui-sandbox-ok`, then `!!printf tui-double-bang-ok`. Require both markers and independently verify an attempted `../escape.txt` write stays denied. RPC coverage alone does not verify both TUI entries.
- **Model tool path.** With an approved model, request `bash` to write `workspace-ok.txt`, then attempt `../escape.txt`. Require recorded tool arguments, successful workspace file readback, failure outside the grant, and no escape file.

## Gotchas

- Native prerequisites fail rather than skip. Record the diagnostic and stop.
- Running inside another sandbox may prevent nested MXC. `--commands-only` can verify commands but cannot certify enforcement.
- The integration suite has live coverage only for macOS Seatbelt; other backends remain separate targets.
- Other Pi tools and extension subprocesses remain local. No test here certifies whole-agent isolation.
