# Repository guide

## Workspace and entrypoints

This pnpm workspace contains TypeScript/ESM Pi extensions, not a single application. Each package's `package.json` declares its runtime entrypoints in `pi.extensions`; `build` type-checks without emitting JavaScript.

| Package directory        | Responsibility                                                        |
| ------------------------ | --------------------------------------------------------------------- |
| `packages/agent-plugins` | Agent Plugins discovery, trust, hooks, and native MCP adaptation      |
| `packages/copilot`       | Account-specific models over Pi's built-in Copilot provider           |
| `packages/digivolve`     | Adaptive background reflection for repository instructions and skills |
| `packages/local-llm`     | Model provider extensions and the `/local-ai` configuration UI        |
| `packages/sandbox`       | MXC-backed bash execution, not whole-agent isolation                  |
| `packages/webfetch`      | HTTP fetching, content conversion, and TUI previews                   |

Read the package's `AGENTS.md` before changing its behavior. Pull request review workflow: [code-review](.github/skills/code-review/SKILL.md).

## Commands

Use Node >=24 and the `packageManager` version of pnpm. Install from the root with `pnpm install --frozen-lockfile`.

From the root, `pnpm check` runs build, lint, formatting checks, then tests. Individual commands are `pnpm build`, `pnpm lint`, `pnpm fmt:check`, and `pnpm test`; `pnpm fmt` and `pnpm lint:fix` write changes. `pnpm test:lint` runs the shared lint-rule harness.

For narrow validation, run `pnpm build && pnpm lint && pnpm fmt:check` from the affected package, followed by `pnpm test:run` where available. To select tests, use `pnpm exec vitest run <package-relative-test-path>` there. From the root, use `pnpm --filter <name-from-package.json> <script>`.

Copilot, digivolve, and webfetch's `pnpm test` watch; use `test:run` for one-shot execution. Local-llm has no test script; webfetch currently has no tests. Root tests include agent-plugins' local integration tests but exclude sandbox's native/RPC suites; see its guide for prerequisites.

## Shared constraints

Keep dependency versions in the named catalogs in `pnpm-workspace.yaml`; preserve host peer compatibility ranges independently of development pins. Use pnpm for packing/publishing so `catalog:` references resolve.

The root owns `.gitignore`, `.oxfmtrc.json`, `.oxlintrc.json`, and Oxlint dependencies. Keep `oxlint` and `oxlint-tsgolint` peer-compatible; do not add package-local copies or weaken rules for unparsed input. Module mocks and conditional empty-object spreads are rejected; validate external data at its boundary.

Relative TypeScript imports use `.js`, except local-llm's explicit `.ts` imports. Keep vendored `tools/oxlint/anti-slop/` source upstream-identical; follow its `UPSTREAM.md` and preserve provenance/licenses rather than applying formatter or autofix churn.
