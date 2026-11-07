# Use plugin MCP and hooks

Enabled plugins contribute deferred MCP tools and reviewed hook commands to Pi's real runtime.

## Sub-features

- `mcp-search-call` discovers and calls a deferred native tool.
- `mcp-lifecycle` preserves literal environment values and withdraws disabled servers.
- `hooks-decision` transforms input or blocks a matching tool call.
- `hooks-withdrawal` stops hooks after the plugin is disabled and runtime refreshed.

## How to get to it (user POV)

Enable a plugin containing root `mcp.json` or supported hook configuration. Use Pi's `tool_search` and `/mcp`, or submit a prompt that invokes a hook-matched tool. Disable the plugin and run `/reload` to withdraw it.

## Driving it with Pi SDK and RPC

Preconditions: Node and package dependencies are usable; native MCP support is enabled. Use synthetic subprocesses and hooks, never installed private plugins.

- **Native MCP integration.** Run `pnpm --filter @scaryrawr/pi-agent-plugins exec vitest run src/mcp-integration.test.ts`. This launches a real Pi session and stdio server, searches the deferred `where` tool, calls it, checks root/data/cwd and literal environment, and withdraws the disabled tool. Save stdout, stderr, and exit status under `$EVIDENCE`.
- **Hook integration.** Run `pnpm --filter @scaryrawr/pi-agent-plugins exec vitest run src/hooks-integration.test.ts`. Require a denial, prompt transformation, and withdrawal through a real extension runtime. This emits hook events directly and is supporting coverage, not a full user action.
- **End-to-end denial.** Configure the same synthetic denial hook, then ask an approved model in the owned Pi session to use `bash` to write `blocked.txt`. Require a matching `tool_call`, the denial reason, and no file at `workspace / "blocked.txt"`. Disable the plugin, restart, repeat, and independently read the written file. Save both tool-call paths.
- **User bang path.** Send `!printf user-bash-ok` in a real owned PTY. Require the marker and no tool-hook invocation, because interactive bang commands intentionally bypass these hooks.

## Gotchas

- No model calls are needed for existing SDK integration tests, but the end-to-end tool journey requires an authenticated tool-capable model.
- Deferred-tool registration alone does not prove transport execution.
- A denied hook event alone cannot prove absence of a command's side effect.
- Hook commands run on the host. Plugin trust is not isolation.
