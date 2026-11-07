# Manage marketplaces

Users add a marketplace, choose individual plugins, apply changes, and remove the source without changing project configuration.

## Sub-features

- `marketplaces-add` validates a local source and starts plugins disabled.
- `marketplaces-toggle` persists individual enable and disable choices globally.
- `marketplaces-refresh` refreshes a selected source.
- `marketplaces-remove` confirms removal, with cancellation preserving configuration.

## How to get to it (user POV)

Run `/marketplaces` in Pi. Choose `Add marketplace`, the configured source, or `Done`. Inside a source, choose a plugin, `Refresh marketplace`, `Remove marketplace`, or `Back`.

## Driving it with Pi RPC

Preconditions: use `controlled_session("agent-plugins", ".cache/verification/marketplaces")`. Create `workspace / "catalog" / ".github" / "plugin" / "marketplace.json"` with `{"name":"verify-catalog","plugins":[{"name":"verify-demo","source":"./plugins/demo"}]}`. Copy the seeded synthetic plugin into `catalog/plugins/demo`. Do not use a remote source.

- **Add.** Call `client.command("/marketplaces", dialogs=[{"method":"select","title":"Agent Plugin marketplaces","value":"Add marketplace"},{"method":"input","title":"Marketplace","value":str(workspace / "catalog")},{"method":"select","title":"Agent Plugin marketplaces","value":"Done"}])`. Require an `Added verify-catalog` notification and saved global config with `enabled: []`.
- **Enable.** Open `/marketplaces` again. Reply to the outer selector with the absolute catalog path. In the `verify-catalog — toggle a plugin` dialog, select `[off] verify-demo`, then reply to the same dialog with `Back`, and to `Agent Plugin marketplaces` with `Done`. Preserve emitted titles and replies. Require saved `enabled` to equal `["verify-demo"]`.
- **Apply.** Restart the owned process. Require the portable skill visible. Disable the same option, restart, and require it absent. Direct baseline plugins must be cleared first so they cannot mask withdrawal.
- **Remove and cancel.** Choose `Remove marketplace`, answer the `Remove marketplace?` confirmation with `confirmed: false`, and require config unchanged. Repeat with `confirmed: true` and require the source absent.
- **Refresh.** Choose `Refresh marketplace`; require a success notification and rediscover changed synthetic plugin content after restart.

## Gotchas

- Toggle titles contain the marketplace name and punctuation. Match the actual emitted title and option, not a row index.
- The UI writes global configuration only. Assert project config stayed unchanged.
- GitHub add and refresh make network requests and may execute trusted plugin updates after reload. Local coverage does not prove them.
- The baseline does not seed a marketplace. Missing the catalog fixture fails this journey.
