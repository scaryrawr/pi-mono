# Validate Build & Lint

## Purpose

Run the current required validation pipeline for this extension package.

## Steps

Run commands from this package directory, or use `pnpm --filter pi-webfetch <script>` from the monorepo root.

1. Run `pnpm build` — TypeScript must produce zero errors.
2. Run `pnpm lint` — oxlint with type-aware checking must be clean.
3. Run `pnpm fmt:check` — formatting/import sorting must already be correct.
4. Run `pnpm test:run` — Vitest runs once; no test files is currently allowed for this package.

## Exit condition

All four commands complete with exit code 0.
