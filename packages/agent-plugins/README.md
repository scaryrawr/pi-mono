# pi-agent-plugins

Load local [Agent Plugins](https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md) directories into [pi](https://github.com/earendil-works/pi). The loader supports the published 1.0.0 format, not the 1.1.0 working draft. It exposes portable skills through `resources_discover` and validates portable `mcp.json` servers before registering them with Pi's built-in `registerMcpServer` API. MCP support requires Pi 0.99.1 or newer.

## Install

```sh
pi install git:github.com/scaryrawr/pi-agent-plugins
```

Keep Pi's built-in MCP and tool-search extensions enabled. Pi owns MCP connections, OAuth, tool discovery, execution, and shutdown; this loader only adapts the portable configuration. No separate `pi-mcp` or `pi-dynamic-tools` extension is required.

If upgrading, remove `pi-mcp` and `pi-dynamic-tools` from your Pi settings after updating this loader. Native MCP configuration belongs in `<pi agent directory>/mcp.json` under `mcpServers`, or in a trusted project's `.pi/mcp.json`. Pi's built-in support does not read legacy flat maps, `.mcp.json`, config in the working directory, `PI_MCP_CONFIG_DIRS`, or `--mcp`.

Use `/mcp` or `pi mcp login <server>` instead of `/mcp-login`. Old `mcp-oauth/` credentials require a fresh login. Built-in `tool_search` replaces `search_tools` with keyword ranking. It does not support the old semantic-model mode.

## Configure

Create `<pi agent directory>/pi-agent-plugins.json` for global plugins, or `<project>/.pi/pi-agent-plugins.json` for project plugins. Pi reads project configuration only in trusted projects and may use a different project config directory name.

Direct `plugins` paths must name existing local directories, not URLs, archives, or pi package names. The loader resolves relative paths against the config file. Review packages before adding them because they run as trusted code.

```json
{
  "plugins": ["/absolute/path/to/my-plugin", "../plugins/other-plugin"],
  "marketplaces": [
    { "source": "https://github.com/scaryrawr/scarypilot", "enabled": ["anti-slop"] },
    { "source": "../local-marketplace", "enabled": ["my-plugin"] }
  ]
}
```

### Marketplaces

Use `/marketplaces` in pi to add a local marketplace directory or an HTTPS GitHub repository such as `https://github.com/owner/repo`. The command also lets you browse entries, toggle plugins, refresh a cached checkout, or remove a marketplace from global config. New marketplace plugins start disabled.

A marketplace must contain `.github/plugin/marketplace.json`, as in [scarypilot](https://github.com/scaryrawr/scarypilot/blob/main/.github/plugin/marketplace.json). If that file is absent, the loader checks Codex's `.agents/plugins/marketplace.json`, as in [scarydex](https://github.com/scaryrawr/scarydex). Both formats require a marketplace `name` and `plugins` entries with a `name` and local `./` source. The source can be `"source": "./plugins/my-plugin"` or Codex's `"source": { "source": "local", "path": "./plugins/my-plugin" }`.

Only sources inside the real marketplace root are allowed. The loader skips remote sources and symlinks that escape that root. Each selected plugin needs a parseable root `plugin.json` with a valid `name`. If that file is absent, the loader checks `.codex-plugin/plugin.json`. An invalid primary manifest or one that escapes the root is rejected rather than bypassed through a fallback path.

Portable and Codex skills load only from the plugin root's `skills/` directory. For schema-less root Copilot manifests, `skills` accepts a relative directory path or an array of paths, such as `"skills": ["skills/"]` in ScaryPilot. These paths replace the default `skills/` location. Each directory contributes its immediate `<name>/SKILL.md` children. Paths and symlinks must remain inside the canonical plugin root, and duplicate files load once.

The loader does not use Codex interface metadata. Copilot `agents` is recognized but skipped with an explicit warning because Pi has no native custom-agent loader. Agent files are not converted into skills or prompt templates. The loader adapts plugin hooks as described below.

For compatibility with marketplace packages, the loader accepts a missing `$schema` and validates the core Agent Plugins v1 manifest fields. A schema-less root manifest also enables the Copilot skill-path compatibility described above. An explicit schema other than the v1.0.0 URL is rejected. A marketplace failure does not prevent direct plugins or other entries from loading.

To add ScaryDex, run `/marketplaces`, choose "Add marketplace", and enter `https://github.com/scaryrawr/scarydex`. Then select the marketplace to enable individual plugins. If a failed add left a cached clone, retry the add. The loader reuses the clone and saves the config after validating the catalog.

The UI clones GitHub marketplaces to `<pi agent directory>/marketplaces/<hash-of-URL>`. Startup uses the cached checkout without network access. To pull changes, choose "Refresh" in `/marketplaces`. If you configure a GitHub URL by hand, add it through the UI once to populate the cache. The loader reads local marketplaces directly from disk.

Pi honors project marketplace config only in trusted projects. The UI writes global config only. After enabling, disabling, refreshing, or removing plugins, run `/reload` to apply the changes, including MCP connections. Review marketplace code before enabling it because MCP servers and hook commands run with your permissions. Marketplace discovery is a pi convenience, not a portable Agent Plugins v1 component.

### Plugin layout

Example package:

```text
my-plugin/
├── plugin.json
├── skills/
│   └── explain/
│       └── SKILL.md
├── mcp.json                         # optional
└── com.scaryrawr.pi/
    └── prompts/
        └── review.md               # optional, pi-specific
```

The published v1.0.0 specification requires `$schema` in `plugin.json`. This loader also accepts its omission for compatibility:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-plugin"
}
```

An optional `mcp.json` declares servers. See the [spec](https://github.com/agentplugins/agent-plugins-spec/blob/main/spec/1.0.0.md#72-mcp-servers):

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "validator": { "type": "stdio", "command": "./bin/validator" }
  }
}
```

The loader discovers portable components only at `skills/<name>/SKILL.md`, one level deep, and root `mcp.json`. Missing locations are allowed. Invalid skills or MCP server entries do not prevent valid siblings from loading.

### MCP servers

The adapter supports stdio and Streamable HTTP but skips legacy `sse`. Server names contain a sanitized plugin name, a canonical-root identity hash, and a sanitized server name with a name hash. This prevents collisions between namesakes or names with different punctuation. Tools use the name `mcp__<server>__<tool>` and `deferred` exposure. Pi's built-in `tool_search` loads matching tools on demand. Registered servers appear in `/mcp`, where a matching `mcp.json` entry takes precedence.

Portable environment and header values remain literal. Only stdio `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` placeholders expand. These values do not use Pi's shell-command or environment interpolation syntax.

MCP subprocesses receive `PLUGIN_ROOT` and persistent `PLUGIN_DATA`. The loader stores data in `<pi agent directory>/plugin-data/<hash-of-canonical-plugin-root>`. Keep this directory to preserve server state across plugin updates.

After editing config or package contents, use `/reload` to restart the extension runtime and refresh resources and MCP connections. Pi can replace registrations and disconnect withdrawn servers within a runtime. A new session rebuilds this loader's registrations.

### Pi prompt templates

Prompts are not a portable Agent Plugins v1 component. This extension loads direct `.md` files from `com.scaryrawr.pi/prompts/` as pi prompt templates. It ignores a root-level `prompts/` directory and symlinks that escape the resolved plugin root. Pi may further validate or deduplicate contributed skills and templates according to its own resource rules.

## Plugin hooks

The loader adapts [Copilot hooks](https://docs.github.com/en/copilot/reference/hooks-reference) and [Codex hooks](https://learn.chatgpt.com/docs/hooks), not repository or user hook settings from either application. Root `plugin.json` selects Copilot defaults, `hooks.json` and `hooks/hooks.json`. A `.codex-plugin/plugin.json` manifest selects Codex's default, `hooks/hooks.json`.

A manifest `hooks` field replaces those defaults. It accepts a relative file path, an inline hooks object, or an array of either. Copilot paths can use `hooks/hooks.json` or `./hooks/hooks.json`; Codex paths must start with `./`. Absolute paths, paths that escape the plugin root, and escaping symlinks are rejected. The loader skips invalid files and handlers without disabling skills, prompts, MCP, or other hooks.

Adding a direct plugin or enabling a marketplace plugin trusts its hook commands, including future edits and refreshes. This loader does not implement Codex's per-definition hash review, either application's sandbox, or enterprise policy enforcement. Commands run on the host with your permissions and can read prompts, tool arguments and results, and the Pi transcript. Review code before enabling it. To stop its hooks, disable the plugin and run `/reload`. Set `disableAllHooks: true` to skip an individual hook source.

Example Copilot `hooks.json`:

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "matcher": "bash",
        "bash": "python3 \"$PLUGIN_ROOT/hooks/check.py\"",
        "timeoutSec": 30
      }
    ]
  }
}
```

Equivalent Codex `hooks/hooks.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$PLUGIN_ROOT/hooks/check.py\"",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

| Hook                                        | Pi mapping and supported effects                                                                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionStart` / `SessionStart`             | `session_start`: extra model context; Codex also receives `source: compact` after compaction                                                                      |
| `sessionEnd` / `SessionEnd`                 | `session_shutdown`, including reload/session replacement; advisory output only                                                                                    |
| `userPromptSubmitted` / `UserPromptSubmit`  | `input`, before Pi template expansion; Codex can reject input or add context; Copilot command output is ignored                                                   |
| `userPromptTransformed`                     | `input` after submit hooks: nonempty `modifiedTransformedPrompt` rewrites input, including its displayed text (not a separate persisted model-only transform)     |
| `preToolUse` / `PreToolUse`                 | `tool_call`: deny, ask via UI (deny without UI), argument replacement validated against Pi's tool schema, extra context                                           |
| `postToolUse` / `PostToolUse`               | `tool_result`: Copilot result replacement/context; Codex feedback replaces the completed result, never undoes side effects                                        |
| `postToolUseFailure` / `PostToolUseFailure` | Failed `tool_result`; Codex `PostToolUse` also sees failures                                                                                                      |
| `agentStop` / `Stop`                        | `agent_before_settle`: continuation with reason, at most eight per submitted input; `stop_hook_active` indicates prior continuation; Codex `continue: false` wins |
| `preCompact` / `PreCompact`                 | `session_before_compact`: manual/auto trigger; only Codex can cancel with `continue: false`                                                                       |
| `PostCompact`                               | `session_compact`: additional context; cannot cancel completed compaction or stop Pi recovery                                                                     |
| `Interrupt`                                 | Aborted `agent_before_settle`: advisory only                                                                                                                      |
| `errorOccurred` / `ErrorOccurred`           | Tool failures, failed compactions, and failed settlement (generic agent error); not every internal Pi error                                                       |
| `notification` / `Notification`             | `ui_prompt_start` approximated as `elicitation_dialog`; no shell/background-agent notification coverage                                                           |

The loader supports only synchronous command handlers, including Copilot `exec`/`args`, platform shell overrides, `cwd`, literal `env`, and timeouts in seconds. It warns and skips HTTP, MCP-tool, prompt/agent, and background handlers, as well as `PermissionRequest` and subagent events. Pi has no equivalent native permission service or subagent lifecycle. No hooks run for interactive `!` shell commands. Commands invoked by hooks do not recursively trigger tool hooks. Pi nested tool calls do trigger tool hooks.

Copilot camelCase event names receive camelCase payloads and anchored regex matching against Pi tool names. PascalCase/Codex events receive snake_case payloads and match Pi names or their aliases. The aliases are `Bash` for `bash`, `Read` for `read`, `Write` for `write`, `Edit` for `edit`, `Grep` for `grep`, and `Glob` for `find`. Codex regexes are unanchored unless explicitly anchored. MCP tools keep Pi's registered names.

Tool input remains Pi-native, using `path` rather than `file_path`, for example. Transcripts remain Pi JSONL, not Copilot or Codex transcripts. The loader does not fabricate turn IDs or permission modes.

Copilot handlers execute in declaration order. Matching Codex handlers start concurrently and merge in declaration order. Any denial wins. Copilot `preToolUse` command errors fail closed, except timeouts. Codex errors fail open except explicit exit `2` decisions. All timeouts fail open and warn.

Default timeouts are 30 seconds for Copilot and 600 seconds for Codex. Codex session-end and interrupt hooks default to 1 second, with a 3-second cap. The loader limits output to 1 MiB per invocation and aggregated context to 10,000 characters. Oversized output terminates the hook. The loader strips Copilot progress JSON lines before parsing the final JSON. It does not support output spilling or `additionalContextLimit`.

Hook processes receive `PLUGIN_ROOT`, `PLUGIN_DATA`, `COPILOT_PLUGIN_ROOT/DATA`, and `CLAUDE_PLUGIN_ROOT/DATA`. Data uses the same persistent directory as MCP. Shell hooks can use `$PLUGIN_ROOT`. Values in `env` and direct-exec arguments are literal, with no config-value expansion.

Hooks run in Pi's session working directory by default. In an explicit `cwd`, the loader expands `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`, including their `COPILOT_PLUGIN` and `CLAUDE_PLUGIN` aliases. It then resolves relative paths against the session working directory. Other environment references remain literal; `cwd` never evaluates shell commands. On operation abort or runtime shutdown, it cancels POSIX process groups or the direct child on Windows. It adds context as custom Pi messages rather than overwriting the system prompt.

## Development

Install dependencies from the monorepo root, then run package commands:

```sh
pnpm install --frozen-lockfile
pnpm --filter @scaryrawr/pi-agent-plugins build
pnpm --filter @scaryrawr/pi-agent-plugins lint
pnpm --filter @scaryrawr/pi-agent-plugins test
pnpm --filter @scaryrawr/pi-agent-plugins fmt:check
```

`pnpm install` requires access to the configured npm registry. There are no Git dependencies or bundled MCP transports. Shared versions live in the workspace catalog. See the [monorepo development guide](../../README.md#development).
