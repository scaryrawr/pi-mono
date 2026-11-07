---
name: verify-webfetch
description: Verify pi-webfetch real tool calls, HTML conversion, images, limits, and TUI previews through isolated Pi sessions and local HTTP fixtures. Use after changing fetching or rendering.
---

# Verify webfetch

Draft: creation-time Pi startup was blocked by filesystem permissions. Read [shared setup and proof rules](../verification/README.md) and the [feature index](features/README.md).

## Launch

From the repository root, run `pnpm install --frozen-lockfile`, then `pnpm --filter @scaryrawr/pi-webfetch build`. No webfetch configuration or migrations are needed. The real model-tool path needs an explicitly approved authenticated model.

Select an available provider/model ID and export it as `VERIFY_MODEL`. Use a standard provider API-key environment variable for a dedicated verification account. For OAuth, export `VERIFY_AUTH_FILE` naming an explicitly approved dedicated verification `auth.json`, never the active user's store. The driver copies that file into scratch state and never saves it as evidence.

```sh
EVIDENCE="$PWD/.cache/verification/webfetch-$(date +%Y%m%dT%H%M%S)-$$"
: "${VERIFY_MODEL:?Select an approved authenticated verification model}"
./.github/skills/verification/scripts/drive.py webfetch --evidence "$EVIDENCE" --model "$VERIFY_MODEL"
```

For dedicated OAuth credentials, add `--auth-file "$VERIFY_AUTH_FILE"` to the same command. This is a live model call and may incur charges. The driver declares only `webfetch`, starts its own loopback HTTP server on an allocated port, and asks the model to fetch that exact URL. Ready means the owned Pi session is idle, the fixture is usable, and the selected model has credentials. A successful `prompt` response is only acceptance, not completion.

## Doctor

Check `version.txt`, `doctor.json`, selected model state, and safe `pi auth check --json --no-refresh` output in the same isolated agent directory if authentication is suspect. Never print credentials. Inspect `fixture.json` and `http-requests.txt` to distinguish tool failure from model failure. A model that never calls the tool fails the journey.

## Drive

The baseline runs [HTML conversion](features/html.md) and waits for `agent_settled`, requiring a real successful `webfetch` result with `# Verification page`. [Images](features/images.md) and [limits and previews](features/limits-preview.md) need their own journeys. Tests that stub fetch support these checks but do not replace live HTTP and TUI proof.

## Evidence

Capture the exact tool arguments, tool result, fixture request, assistant completion, and any error. Image proof includes MIME type and decoded image bytes. Limits proof distinguishes the 5 MiB decoded-download limit from 2000-line or 50 KB text truncation. TUI previews require a real terminal transcript or screenshot with the call and resulting preview, not an RPC notification.

The loopback HTML fixture isolates the production HTTP boundary. It does not verify remote TLS, redirects, public sites, images, streaming limits, or preview layout. No dry-run exists; the live drive contacts the selected provider and local server. Do not share private model transcripts or keys.

## Cleanup

The driver closes its owned Pi process, shuts down its own HTTP server, and removes scratch credentials and workspace. It preserves `$EVIDENCE`, including after errors. Require `scratchRemoved: true` in `result.json`; inspect HTTP and exit logs before claiming cleanup. Never kill an existing server by name.

## Helpers

The executable shared driver is shown above and documented in [verification support](../verification/README.md). Use `/maintain-verification-skill` after changing tool contracts or preview controls.
