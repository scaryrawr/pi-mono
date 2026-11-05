# pi-mono

Extensions for the Pi coding agent. Install the packages you need.
The original five packages keep the full git history of their standalone
repositories. Digivolve currently has a pinned source-snapshot import; see its
[migration record](packages/digivolve/README.md#migration-source).

## Packages

| Package                                   | What it does                                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [`agent-plugins`](packages/agent-plugins) | Loads Agent Plugins skills, MCP servers, and hooks from local directories or marketplaces.                |
| [`copilot`](packages/copilot)             | Adds account-specific models to Pi's built-in GitHub Copilot provider.                                    |
| [`digivolve`](packages/digivolve)         | Runs adaptive background reflection to improve durable repository instructions and skills.                |
| [`local-llm`](packages/local-llm)         | Discovers models from Ollama, LM Studio, OMLX, Osaurus, and GenieX. Configure providers with `/local-ai`. |
| [`sandbox`](packages/sandbox)             | Runs bash through Microsoft MXC. Other Pi tools and extensions remain outside the sandbox.                |
| [`webfetch`](packages/webfetch)           | Adds a `webfetch` tool that converts HTML to Markdown and returns images as image content.                |

Each package's README covers its configuration and requirements.

## Install from a checkout

Use Node.js 24 or newer and the pnpm version pinned in the root `package.json`.
With Pi installed, clone this repository and install its dependencies:

```sh
git clone https://github.com/scaryrawr/pi-mono.git
cd pi-mono
pnpm install --frozen-lockfile
```

Point Pi at the package directory you want to use, not the workspace root.
For example:

```sh
pi install /absolute/path/to/pi-mono/packages/copilot
```

Replace the path with your checkout location. Repeat for any other packages you
want to enable. Extension entrypoints are TypeScript, so no JavaScript build is
needed.

## Development

Run workspace commands from the repository root:

```sh
pnpm check
```

`pnpm check` runs type checks, lint, formatting checks, and available tests.
`pnpm build` type-checks with [tsrs](https://www.npmjs.com/package/tsrs) without
emitting JavaScript. Package tsconfigs retain their existing strictness settings;
tsrs runs in its default compatibility mode (without `--fast`).

| Command          | What it runs                                              |
| ---------------- | --------------------------------------------------------- |
| `pnpm build`     | Each package's type check.                                |
| `pnpm lint`      | Shared Oxlint rules across packages and lint-rule tests.  |
| `pnpm fmt:check` | Root and package formatting checks.                       |
| `pnpm test`      | Shared lint-rule tests and available package tests, once. |
| `pnpm fmt`       | Writes formatting changes.                                |
| `pnpm lint:fix`  | Applies lint fixes.                                       |

Run a single package with its scoped name from `package.json`:

```sh
pnpm --filter @scaryrawr/pi-copilot build
pnpm --filter @scaryrawr/pi-copilot test:run
pnpm --filter @scaryrawr/pi-copilot test # watch mode
pnpm --filter @scaryrawr/pi-mxc test:integration
```

Workspace tests include agent-plugins' local integration tests but exclude MXC's
native integration and RPC suites. Local-llm has no test script, and webfetch
currently has no tests. MXC's additional suites require host prerequisites;
see its [development instructions](packages/sandbox/README.md#develop-and-verify).
Git ignore rules, formatter settings, and lint rules live at the repository root.
Package-local TypeScript configurations and runtime entry points remain separate.

## Shared lint tooling

The root owns `oxlint`, `oxlint-tsgolint`, and `@oxlint/plugins` through the `lint`
catalog. All packages use the root `.oxlintrc.json`, including the same generic
Anti-Slop rules. Root linting discovers each file's nearest tsconfig; filtered
package commands explicitly select the same shared configuration.
The root `tsconfig.json` covers only the lint-rule tests.

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
| `typescript` | tsrs TypeScript type checker    |
| `test`       | Test runner                     |
| `runtime`    | Runtime libraries and SDKs      |

Host-provided peer dependency ranges remain in each package manifest rather
than inheriting the development version.
Strict catalog mode requires new dependencies to use catalogs.
When adding a dependency, select its group with
`pnpm --filter <package-name> add <dependency> --save-catalog-name <group>`
and add `-D` for development tools.

After changing dependencies, run `pnpm install` at the root and commit the
updated manifests, workspace catalog, and lockfile together. Keep lint and test
tools in dev dependencies. The workspace uses one `pnpm-lock.yaml`, not
per-package npm lockfiles.

The workspace permits native build scripts for `koffi` and `node-pty`. It
disables the Google SDK's no-op preinstall and Protobuf's version-warning
postinstall. Review new dependency build scripts before enabling them.

Use `pnpm --filter <package-name> pack` or `pnpm publish` for distribution so
catalog references are replaced with concrete version ranges. Do not use
`npm pack` or `npm publish` on manifests containing `catalog:`.
