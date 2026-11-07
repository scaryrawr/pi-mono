# Keep startup usable without a catalog

Users retain curated Copilot model choices when a cache or persisted catalog is missing, malformed, expired, or unusable.

## Sub-features

- `fallback-cold` starts with no cache or credentials.
- `fallback-invalid` tolerates malformed or expired cache and model-store files.
- `fallback-empty` avoids publishing an empty whole catalog.

## How to get to it (user POV)

Start Pi in a fresh agent directory, or restart after its disposable cache becomes unusable. Do not repair the fixture before observing startup.

## Driving it with Pi RPC

Preconditions: shared setup passes. Each condition needs a fresh Pi process because the extension reads the cache at module startup.

- **Supporting checks.** Run `pnpm --filter @scaryrawr/pi-copilot exec vitest run extensions/copilot.test.ts extensions/copilot/catalog.test.ts extensions/copilot/cache.test.ts`. Save the command, output, and exit code. These tests are not an installed-Pi startup journey.
- **Cold startup.** Create a new temporary agent directory without `copilot-models.json`, load `packages/copilot` with the shared isolated launch flags, and call `get_available_models`. Require at least one `github-copilot` model and idle startup.
- **Malformed files.** In another scratch agent directory write `{` to `copilot-models.json` and `models-store.json`, then start a new owned Pi process. Require the same nonempty fallback, with no fatal extension error.
- **Expired cache.** Use the baseline cache shape but set `cachedAt` to `2000-01-01T00:00:00Z`. Start a fresh process. Require `verify-cache-model` absent and a nonempty curated catalog present.
- **Unusable catalog.** Seed `content: {"data":[]}` with a current timestamp. Start a fresh process and require nonempty curated fallback.

## Gotchas

- Editing a cache after startup does not test startup loading. Restart the process, not just the conversation.
- Catalog presence without credentials is expected and does not prove inference readiness.
- Ordinary missing models in a usable account payload must not be retained by misapplying whole-catalog fallback.
- `controlled_session` seeds a warm cache by default. Do not use its unchanged seed for cold coverage.
