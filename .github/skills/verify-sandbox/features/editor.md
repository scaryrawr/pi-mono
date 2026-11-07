# Edit sandbox JSON safely

Users edit session policy or saved defaults through the real editor, cancel without changes, and reject invalid JSON without weakening bash restrictions.

## Sub-features

- `editor-cancel` preserves config and effective policy.
- `editor-invalid` rejects malformed JSON.
- `editor-session` edits only the session snapshot.
- `editor-persist` writes validated saved defaults without replacing active overrides.

## How to get to it (user POV)

Run `/sandbox edit` for session policy or `/sandbox --persist edit` for saved defaults. Cancel the editor or submit validated JSON.

## Driving it with Pi RPC

Preconditions: shared `controlled_session("sandbox", ".cache/verification/sandbox-editor")` and `/sandbox init`. Preserve the original saved file before each mutation.

- **Cancel.** Call `client.command("/sandbox edit", dialogs=[{"method":"editor","title":"MXC bash sandbox policy (session only)","cancelled":True}])`. Require both disk and effective policy unchanged.
- **Reject.** Submit the same editor reply with `value: "{"`. Require an error notification and unchanged saved and effective policy. Do not repair the file before observing rejection.
- **Session edit.** Parse the original JSON, append `/editor-session-access` to `filesystem.readonlyPaths`, and reply with the serialized JSON. Require `/sandbox status` contains the grant but the saved file does not. Reset and require it absent.
- **Saved edit.** Use `/sandbox --persist edit` with title `MXC bash sandbox policy (saved defaults)`. Require a valid change on disk while unrelated active session overrides still apply.
- **Extended coverage.** Run `pnpm --filter @scaryrawr/pi-mxc test:rpc --commands-only`. This covers editor validation, cancellation, scope, optional-field reset, and fail-closed malformed config through the installed CLI.

## Gotchas

- Use the editor request's ID for replies. The shared client handles this when method and title match.
- Direct file editing changes saved defaults and is not the session-editor path.
- Malformed config must block bash even with a prior session off override. Local opt-out must not hide invalid-policy failure.
- RPC editor proof does not verify terminal editor layout.
