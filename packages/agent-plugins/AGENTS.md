# Agent plugins

## Ownership and portable contracts

Keep portable discovery and containment in `src/plugin.ts`, configuration/trust in `src/config.ts`, lifecycle cleanup in `src/index.ts`, and MCP adaptation in `src/mcp.ts`.

Implement Agent Plugins 1.0.0, not legacy dialects by accident. Portable `prompts/` is not a v1 component; Pi prompts live under `com.scaryrawr.pi/prompts/`. Update README configuration examples when behavior changes.

Resolve paths against the canonical plugin root and reject escapes, including symlinks. Isolate independent component failures so one bad component does not disable valid siblings. Only load project configuration when trusted; configuration UI writes remain global.

## MCP and hooks

Pi owns MCP transports, OAuth, and discovery through `pi.registerMcpServer`; do not reintroduce `pi-mcp` or `pi-dynamic-tools`. Keep deferred exposure and built-in `tool_search`. Escape Pi's config-value syntax in portable environment/header values so literals cannot become shell commands or arbitrary environment references.

Preserve explicit hook trust and dialect-specific decisions. Validate hook argument replacements and keep output/context bounded. Clean up registrations, subprocesses, and cancellation listeners on shutdown.

## Tests

Use the root command inventory. The ordinary suite includes native MCP and hook integration tests using local subprocesses and real Pi sessions. Isolate their agent directories and emit `session_shutdown` before disposing sessions.
