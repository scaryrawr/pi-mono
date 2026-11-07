# Return fetched images

Webfetch returns an image response as base64 ImageContent with its media type, rather than replacing it with text.

## Sub-features

- `images-content` preserves PNG bytes and MIME type through a real HTTP tool call.
- `images-display` exposes the returned image through Pi's supported image display path.

## How to get to it (user POV)

Give Pi an image URL and ask it to call webfetch. Inspect the image tool result. Image display depends on Pi and terminal capabilities.

## Driving it with Pi RPC and HTTP

Preconditions: approved authenticated `VERIFY_MODEL`. The driver serves a synthetic one-pixel PNG at `/image`; no external image host is required.

- **Fetch.** Run `./.github/skills/verification/scripts/drive.py webfetch --webfetch-case image --evidence "$EVIDENCE" --model "$VERIFY_MODEL"`. Append the explicitly approved dedicated OAuth option only when needed.
- **Observe the action.** Require an actual call to the `/image` URL from `fixture.json` and a matching HTTP request.
- **Inspect content.** Require an `image` content block with `mimeType: image/png`. The driver decodes base64 and compares it to the fixture bytes, then saves `image.png` independently of scratch state.
- **Display.** Drive the same URL in an owned image-capable Pi TUI and capture the actual result presentation. Record unsupported terminal image display as a missing precondition, not a fetch failure or fabricated screenshot.
- **Supporting boundary checks.** Run `pnpm --filter @scaryrawr/pi-webfetch exec vitest run extensions/webfetch.test.ts` for the existing image-at-limit test. It stubs fetch and does not replace real HTTP coverage.

## Gotchas

- RPC image bytes prove transport and content, not visible terminal rendering.
- The extension's custom result renderer currently builds text previews; do not assume it draws the returned image itself.
- A one-pixel fixture cannot prove useful visual detail or all supported image media types.
- Images over 5 MiB are download failures, not text truncation.
