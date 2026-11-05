# Vendored Anti-Slop

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop), revision
[`13909c9e07590f5a85d93c62712259fe14a883f7`](https://github.com/dmmulroy/anti-slop/commit/13909c9e07590f5a85d93c62712259fe14a883f7).

The contents of upstream `src/` are copied here without modifications, including
the upstream rule tests. `LICENSE` is upstream's MIT license. The separate
ESLint Stylistic license and provenance remain under `vendor/eslint-stylistic/`.
Oxlint dependencies are owned by the monorepo root and use its `lint` catalog;
upstream's development dependency versions are not copied.

The root `.oxlintrc.json` enables the generic rules for every package. The
optional Effect plugin is retained upstream source, but is not enabled.
`pnpm test:lint` runs the upstream tests through the existing Vitest runner.

To update, select an upstream commit, replace the vendored `src/` contents and
license, update this revision, then run `pnpm test:lint` and `pnpm check`.
Do not format or autofix the vendored sources; preserve an exact upstream copy.
