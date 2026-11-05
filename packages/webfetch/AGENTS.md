# Webfetch

`extensions/webfetch.ts` is the sole Pi extension entrypoint. Keep tool parameters, description, executor results, and TUI rendering consistent when changing behavior.

Accept only HTTP(S) input URLs and forward cancellation to fetch. Convert HTML with Turndown; return images as base64 `ImageContent` rather than text. Apply `truncateHead` to text and preserve truncation metadata. The executor buffers the response before conversion; text-output truncation is not a network-download size limit.

Catch execution failures into typed `AgentToolResult` content/details rather than throwing to the agent. Do not persist unrelated state across calls. Keep preview state scoped to the call, cache width-dependent rendering in component state, and clean up streaming render timers.

Build TUI previews with Pi TUI primitives. Keep public helpers documented with JSDoc where applicable; prefer pure-helper tests over tests dependent on live servers.

Use the root command inventory. `test:run` currently permits no tests; a successful empty run is not behavioral coverage.
