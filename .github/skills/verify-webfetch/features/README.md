# Webfetch verification map

Use local HTTP fixtures and an explicitly approved model account for the real tool-call path. Read the [shared driver and evidence contract](../../verification/README.md).

- [HTML](html.md): real tool call, HTML-to-Markdown, text responses, and HTTP failure.
- [Images](images.md): image content, MIME type, base64, and visual preview.
- [Limits and preview](limits-preview.md): download limits, output truncation, cancellation, and real TUI rendering.

Capture tool actions and results together. Fetch-stub tests do not prove HTTP transport or a model-selected tool call. RPC does not prove terminal preview layout. If a model, fixture route, or PTY is missing, report that journey blocked rather than substituting a different entry point. Creation-time runtime proof is blocked; all entries remain unverified until run.
