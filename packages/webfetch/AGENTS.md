# pi-webfetch Repository Guidelines

## Project Structure & Module Organization

This is a pi coding-agent extension package. `package.json` loads the extension entry point from `pi.extensions`: `extensions/webfetch.ts`.

- `extensions/webfetch.ts` registers `webfetch`: accepts only `http:`/`https:` URLs, fetches pages, converts `text/html` through Turndown, returns image responses as base64 `ImageContent`, truncates text with `truncateHead`, and renders custom TUI previews.

## Build, Test, and Development Commands

Install dependencies from the monorepo root. Run these from this package directory, or use `pnpm --filter pi-webfetch <script>` from the root. Dependency versions belong in the named catalogs in `pnpm-workspace.yaml`; package dependencies and dev dependencies use `catalog:<group>`, while host peer compatibility ranges remain literal.

- `pnpm build` — TypeScript check with `tsgo -p ./tsconfig.json`; this must pass before handoff.
- `pnpm lint` — `oxlint` with type-aware checking over `extensions/**/*.ts`.
- `pnpm fmt:check` — verify formatting/import sorting; use `pnpm fmt` to rewrite formatting.
- `pnpm lint:fix` — auto-fix supported lint issues.
- `pnpm test:run` — one-shot Vitest with `--passWithNoTests` because this package currently has no test files. Plain `pnpm test` starts watch mode.

The monorepo root owns Oxlint dependencies, `.oxlintrc.json`, and the vendored `tools/oxlint/anti-slop/` rules. Do not duplicate them in packages. `oxlint` declares an optional `oxlint-tsgolint` peer that powers type-aware rules; update both catalog entries together and reinstall from the root. Read the peer range in the root's `node_modules/oxlint/package.json` instead of guessing it from the oxlint version.

Use `pnpm build && pnpm lint && pnpm fmt:check && pnpm test:run` as the current required validation path.

## Coding Style & Naming Conventions

TypeScript is strict ES2024 with `module: nodenext`, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, and `noUncheckedSideEffectImports`. Keep relative imports compatible with NodeNext (`.js` extensions when any are added). `oxfmt` sorts imports.

Use `camelCase` for functions and `PascalCase` for exported types/classes. Keep public helpers documented with JSDoc `@param`/`@returns`. Tool executors should catch errors and return typed `AgentToolResult` content/details rather than throwing to the agent.

## Testing Guidelines

If you add tests, use Vitest naming that its defaults discover (`*.test.ts` or `*.spec.ts`) and include `pnpm test:run` in validation. Prefer exported pure helpers over network-dependent tests.

## Security & Agent-Specific Instructions

Preserve protocol and size limits: `webfetch` must not fetch non-HTTP(S) URLs, and outputs must stay bounded by the 5 MB fetch buffer plus `truncateHead` defaults (2000 lines / 50 KB). Do not persist state between tool calls. Keep TUI renderers built from `@earendil-works/pi-tui` primitives and cache width-dependent preview work in component state.
