# Fetch HTML as Markdown

The agent calls webfetch on a supplied HTTP URL and receives readable Markdown from the real response.

## Sub-features

- `html-convert` returns an ATX heading and paragraph from HTML.
- `html-text` preserves plain-text content without HTML conversion.
- `html-http-error` reports an HTTP failure as tool output.

## How to get to it (user POV)

Paste an HTTP or HTTPS URL into a Pi prompt and ask the agent to fetch it with `webfetch`. Inspect the tool call and its result, not only the assistant's summary.

## Driving it with Pi RPC and HTTP

Preconditions: usable Pi and explicitly approved authenticated `VERIFY_MODEL`. The driver starts its own loopback `/page` fixture.

- **Launch and drive.** Run `./.github/skills/verification/scripts/drive.py webfetch --evidence "$EVIDENCE" --model "$VERIFY_MODEL"`. For an approved dedicated OAuth file, append `--auth-file "$VERIFY_AUTH_FILE"`.
- **Observe the action.** Require the transcript's real `webfetch` call to use the URL from `fixture.json` and the server log to show `/page`.
- **Observe conversion.** Require `webfetch-result.json` to contain `# Verification page` and `Read through webfetch.` as text. Require one tool result, no provider error, and `agent_settled`.
- **Plain text.** The truncation journey uses a real `text/plain` route and verifies text rather than HTML conversion. Record it separately under [limits](limits-preview.md).
- **HTTP error.** Point a separate real tool call at a nonexistent route on the owned fixture. Require returned text beginning `Error: Failed to fetch`, preserve the 404 request, and require the agent remains usable. The baseline does not drive this path.

## Gotchas

- The model may answer without calling webfetch. That fails the journey even if the summary happens to be correct.
- Tool errors are returned as typed text. They do not necessarily set the event's `isError` flag.
- Loopback proof does not cover HTTPS, redirects, or public sites.
- A successful prompt acceptance response is not settled completion.
