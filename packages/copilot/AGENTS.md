# Copilot provider

`extensions/copilot.ts` projects account-specific `/models` data over Pi's built-in `github-copilot` provider. Pi owns OAuth and credential persistence; this extension owns discovery and projection, not a separate login implementation.

## Lifecycle

Bootstrap from cache without adding uncached network work. Keep model discovery outside OAuth callbacks: Pi resolves credentials under a cross-process auth lock. `refreshModels` performs provider refresh; `session_start` is the fallback.

Do not call `pi.registerProvider` inside `refreshModels`: re-registration invalidates the in-flight publication and queues another refresh. Return the projected list for Pi to publish. Preserve curated fallback when no usable models remain, including the non-OAuth branch, rather than deliberately publishing an empty catalog.

Auth, network, cache, and malformed-store failures must not break Pi startup. Enterprise domains are optional. Never log `auth.json`, `copilot-models.json`, or `models-store.json` contents.

## Projection and validation

Keep schemas/parser in `extensions/copilot/types.ts`, capability inference in `inference.ts`, projection in `mapping.ts`, and live provider mutation in `state.ts`.

For usable payloads, apply picker, policy, and tool-support availability rules before projecting models. Preserve existing curated API, reasoning, input, pricing, compatibility, and sampling metadata where the mapping currently gives it precedence; API names and updated limits have their own precedence. Do not retain missing models merely to preserve metadata; distinguish this from whole-catalog fallback.

For a new capability, update schema, inference, mapping, and any compatibility constants together. Prefer explicit capability flags over endpoint/id heuristics. Change Copilot request headers only deliberately; they affect endpoint compatibility.

Parse model responses through `ModelResponseParser`; use the owning TypeBox schemas for auth, cache, and model-store boundaries. Preserve top-of-file module-role docblocks when adding modules.

## Tests

Use the root validation commands. Set `PI_CODING_AGENT_DIR` before dynamically importing modules that capture paths. Stub global `fetch` with `vi.stubGlobal`, not module mocks; tests must not read real credentials or contact GitHub.
