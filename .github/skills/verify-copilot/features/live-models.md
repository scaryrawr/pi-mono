# Use account-specific Copilot models

Authenticated users receive their allowed account models through Pi's built-in Copilot provider and can obtain a real response.

## Sub-features

- `live-discovery` refreshes the account catalog.
- `live-policy` excludes disabled picker, policy, and non-tool models.
- `live-inference` uses a selected projected model with its intended endpoint.

## How to get to it (user POV)

Log in through Pi's built-in GitHub Copilot OAuth, load this extension, then select an account model in Pi. Use `pi update --models` for a model catalog refresh. Enterprise account domains are a separate entry point.

## Driving it with Pi RPC and TUI

Preconditions: explicitly approved network access, a dedicated verification account, and disposable agent configuration. The offline baseline has no such credentials and must report this journey blocked.

- **Doctor.** In the dedicated agent directory run `pi auth check --provider github-copilot --json --no-refresh`. Require ready without printing resolved credentials.
- **Discover.** Launch an owned Pi RPC process with `-e "$PWD/packages/copilot"` and the shared isolation flags, omitting `--offline`. Call `get_available_models`. Save only safe model IDs and capability metadata, not raw auth, cache, or model-store files.
- **Compare.** Independently obtain the account's allowed model list through an approved account view. Require picker-disabled, policy-disabled, and explicitly non-tool-capable entries absent. If the account has no such entries, report those negative checks unverified.
- **Infer.** Send `set_model` using an ID from that returned catalog, then `{"type":"prompt","message":"Reply exactly with copilot-verification-ok."}`. Wait for `agent_settled`, require a successful assistant response containing the marker, and inspect provider errors.
- **Refresh.** Run `pi update --models` with the same dedicated agent configuration and explicit extension; start a new session and compare safe catalog metadata. Capture refresh as a separate action.

## Gotchas

- A successful prompt response means accepted, not completed. OAuth errors can occur later.
- Login and refresh may access GitHub or open a browser. They are not read-only dry-runs.
- Individual-account proof does not verify enterprise domains, every API family, or credential refresh under a lock.
- Do not copy or inspect the active user's credential store without explicit approval.
