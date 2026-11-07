# Bound downloads and inspect previews

Users receive bounded content, clear truncation metadata, and a responsive preview instead of unbounded downloads or stale rendering.

## Sub-features

- `limits-lines` truncates text after 2000 lines.
- `limits-bytes` bounds text output at 50 KB.
- `limits-download` rejects more than 5 MiB of decoded response bytes.
- `limits-cancel` aborts fetch and releases stalled readers.
- `preview-expand` expands a collapsed 15-visual-line preview.
- `preview-resize` rebuilds width-dependent preview layout and stops elapsed timers.

## How to get to it (user POV)

Ask Pi to webfetch a long page, large download, or slow response. In the TUI, use the displayed expand key hint, resize the terminal, or abort the operation.

## Driving it with Pi RPC, HTTP, and PTY

Preconditions: approved authenticated `VERIFY_MODEL`. Each driver command needs a new evidence directory. Preview proof additionally requires an owned real PTY.

- **Line limit.** Run `./.github/skills/verification/scripts/drive.py webfetch --webfetch-case truncation --evidence "$EVIDENCE" --model "$VERIFY_MODEL"`. The `/long` fixture returns 2100 plain-text lines. Require 2000 output lines, line-based truncation metadata, `line-1999` present, and `line-2000` absent.
- **Download rejection.** With a different evidence directory, run the same driver with `--webfetch-case download-error`. The `/oversize` fixture advertises and sends 5 MiB plus one byte. Require `Error: Response exceeds the 5 MiB download limit.` as typed tool text, not a truncated successful body.
- **Streamed size and cancellation support.** Run `pnpm --filter @scaryrawr/pi-webfetch exec vitest run extensions/webfetch.test.ts`. These tests cover body cancellation and stalled readers with fetch stubs. Separate live routes without Content-Length and with a stalled body are required for transport cancellation proof.
- **Preview.** Fetch the long fixture in an owned TUI. Capture `fetch` plus the URL, the collapsed preview and expand hint, then use the displayed configured key. Require expanded text and the truncation warning. Resize from 120 to 60 columns and back; require rewrapped preview without stale cached lines.
- **Abort.** During a live slow-response fetch, abort through Pi and require execution completion, response-reader release, and no subsequent timer updates. Record the server-side close and terminal action.

## Gotchas

- The bundled fixture does not provide a byte-truncation, unadvertised-oversize, or stalled-response route. Missing those fixtures blocks those sub-features; do not relabel advertised-size rejection as streamed-size proof.
- The line-limit response is below the download limit. These are independent contracts.
- Error text can be returned with `isError: false`; inspect the actual content.
- RPC cannot prove preview expansion, resizing, or timer cleanup. A final screenshot without the action is insufficient.
