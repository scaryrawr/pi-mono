# pi-mono

Monorepo for Pi-related extensions, plugins, and tools. Each package lives under
`packages/<name>` and carries the full git history of its original standalone repository.

## Packages

| Package                                   | Original repository |
| ----------------------------------------- | ------------------- |
| [`agent-plugins`](packages/agent-plugins) | `pi-agent-plugins`  |
| [`copilot`](packages/copilot)             | `pi-copilot`        |
| [`local-llm`](packages/local-llm)         | `pi-local-llm`      |
| [`webfetch`](packages/webfetch)           | `pi-webfetch`       |
| [`sandbox`](packages/sandbox)             | `pi-mxc`            |

## Development

Use Node.js 24 or newer and the pnpm version pinned in the root `package.json`.
Run dependency installation from this directory; the workspace uses one
`pnpm-lock.yaml`, not per-package npm lockfiles.
The workspace permits native build scripts for `koffi` and `node-pty`; the
Google SDK's no-op preinstall and Protobuf's version-warning postinstall are
explicitly disabled. New dependency build scripts require review.

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs every package's type check, lint, formatting check, and available
tests. Builds are type checks only; extension entry points remain TypeScript.
Workspace tests run once, skip packages without a test script, and exclude MXC's
native integration suite. Webfetch currently has no tests.

Root `build`, `fmt`, and `fmt:check` scripts delegate to package scripts.
Root `lint` and `lint:fix` run the shared Oxlint configuration across packages and
the lint-test harness;
`test` runs the shared lint-rule tests and available package tests.
Run a single package from the root with its package name:

```sh
pnpm --filter pi-copilot build
pnpm --filter pi-copilot test:run
pnpm --filter pi-copilot test # watch mode
pnpm --filter pi-mxc test:integration
```

MXC's native integration and RPC suites require additional host prerequisites;
see its [development instructions](packages/sandbox/README.md#develop-and-verify).
Package-local TypeScript and formatter configurations and runtime entry points
stay independent.

## Shared lint tooling

The root owns `oxlint`, `oxlint-tsgolint`, and `@oxlint/plugins` through the `lint`
catalog. All packages use the root `.oxlintrc.json`, including the same generic
Anti-Slop rules. Root linting discovers each file's nearest tsconfig; filtered
package commands explicitly select the same shared configuration.
The root `tsconfig.json` covers only the lint-test harness.

Anti-Slop is vendored once under `tools/oxlint/anti-slop/`, including its license
and upstream tests. The pinned source revision and update procedure are in its
[provenance record](tools/oxlint/anti-slop/UPSTREAM.md). `pnpm test:lint` runs the
upstream rule tests and verifies config loading from root and package directories.
Vendored source is excluded from linting and formatting; update it from upstream
rather than applying repository autofixes to it.

## Dependencies and packaging

Dependency versions live in named `catalogs` in `pnpm-workspace.yaml`.
Package dependencies and dev dependencies reference them with `catalog:<group>`:

| Catalog      | Dependencies                    |
| ------------ | ------------------------------- |
| `pi`         | Pi host packages                |
| `lint`       | Oxlint, Oxfmt, and lint plugins |
| `types`      | TypeScript type declarations    |
| `typescript` | TypeScript compiler             |
| `test`       | Test runner                     |
| `runtime`    | Runtime libraries and SDKs      |

Host-provided peer dependency ranges remain in each package manifest rather
than inheriting the development version. Strict catalog mode keeps additions
using catalogs. When adding a dependency, select its group with
`pnpm --filter <package-name> add <dependency> --save-catalog-name <group>`
(add `-D` for development tools).

After changing dependencies, run `pnpm install` at the root and commit the
updated manifests, workspace catalog, and lockfile together. Keep lint and test
tools in dev dependencies.

To try a local extension, install the workspace dependencies first, then point
Pi at the package directory, for example:

```sh
pi install /absolute/path/to/pi-mono/packages/copilot
```

Use `pnpm --filter <package-name> pack` or `pnpm publish` for distribution so
catalog references are replaced with concrete version ranges. Do not use
`npm pack` or `npm publish` on manifests containing `catalog:`.
