# pi-webfetch

A [pi](https://github.com/mariozechner/pi-coding-agent) extension that adds a `webfetch` tool. It fetches web pages, converts HTML to Markdown, and truncates oversized text responses.

## What it does

Pi can call `webfetch` with an HTTP or HTTPS URL. The extension:

1. Fetches the response.
2. Converts HTML to Markdown using [Turndown](https://github.com/mixmark-io/turndown), with ATX headings, fenced code blocks, and `-` list markers.
3. Truncates text to 2000 lines or 50 KB, whichever comes first.
4. Returns the content as text with optional truncation metadata.

Image responses return as base64 image content instead of text. The tool buffers the full response before conversion, so text truncation does not limit download size. Abort signals cancel the fetch.

## Installation

Install the extension using pi's built-in install command:

```bash
pi install git:github.com/scaryrawr/pi-webfetch
```

## Configuration

No configuration is required.

## License

MIT
