# Edit pi web tools

## Purpose

Make changes to the pi web tool extensions in `extensions/`.

## Steps

1. Read the relevant entry point before editing:
   - `extensions/webfetch.ts` for URL fetching, HTML-to-markdown conversion, image return, truncation, and TUI rendering.
2. Update the `description` in `defineTool` if you change a tool's behavior or parameters.
3. Run `pnpm build && pnpm lint && pnpm fmt:check && pnpm test:run` from this package directory to validate. From the monorepo root, use `pnpm --filter pi-webfetch <script>`. Run `pnpm fmt` only when formatting changes are needed.

## Constraints

- `webfetch` supports only HTTP/HTTPS protocols.
- Preserve truncation to 2000 lines / 50 KB and the 5 MB response buffer limit.
- TUI renderers use `@earendil-works/pi-tui` primitives; cache width-dependent preview work in component state.
- Use NodeNext-compatible relative imports (`.js` extensions if relative imports are added).
- Strict TypeScript options are enforced by `tsconfig.json`.
