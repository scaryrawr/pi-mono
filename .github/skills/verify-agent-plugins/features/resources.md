# Discover plugin resources

Users enable local plugins and receive their portable skills and Pi-specific prompt templates in Pi.

## Sub-features

- `resources-global` discovers directly configured global plugin paths.
- `resources-project` honors project sources only when trusted.
- `resources-restart` withdraws disabled resources on restart or `/reload`.

## How to get to it (user POV)

- Add a local directory to `pi-agent-plugins.json`, then start Pi.
- Add project configuration in `.pi/pi-agent-plugins.json`, then approve that synthetic project.
- Run `/reload` in the TUI after changing configuration or plugin contents.

## Driving it with Pi RPC

Preconditions: shared setup passes. The baseline seeds a valid `verify-demo` skill and `verify-prompt` template in a synthetic direct plugin.

- **Discover global resources.** Run `./.github/skills/verification/scripts/drive.py agent-plugins --evidence "$EVIDENCE"`. Require `resources.json` to contain `skill:verify-demo` and `verify-prompt`, with source paths inside the scratch plugin.
- **Withdraw resources.** In `controlled_session`, write `{"plugins":[]}` to `agent / "pi-agent-plugins.json"`, call `client.restart("withdrawal")`, then `client.request({"type":"get_commands"})`. Require both seeded resource commands absent. This proves fresh-process withdrawal, not TUI `/reload`.
- **Project trust.** Move the synthetic config into `workspace / ".pi" / "pi-agent-plugins.json"`, clear the global plugins, and restart once with `--no-approve` and once with `--approve`. Require absence then presence. Capture the actual config paths and trust flags.
- **TUI reload.** In an owned PTY, change the same disposable config, send `/reload` followed by Enter, and rediscover the commands. Capture the reload action and result separately from fresh-process coverage.

## Gotchas

- `/reload` is a built-in TUI command, not an RPC extension command.
- A root `prompts/` folder is not the supported Pi prompt location.
- The baseline proves discovery, not prompt expansion or model compliance with the skill.
- Escaping symlinks and malformed siblings need separate fixtures. Unit tests support containment checks but do not replace the resource user journey.
