import { afterEach, expect, it, vi } from "vitest";

import { webfetch } from "./webfetch.js";

const LIMIT = 5 * 1024 * 1024;

afterEach(() => vi.unstubAllGlobals());

it("converts HTML and preserves text truncation metadata", async () => {
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response("<h1>Title</h1>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  );
  expect((await webfetch({ url: "https://example.com" })).content).toEqual([
    { type: "text", text: "# Title" },
  ]);

  vi.stubGlobal("fetch", async () => new Response("line\n".repeat(3000)));
  expect((await webfetch({ url: "https://example.com" })).truncation?.truncatedBy).toBe("lines");
});

it("returns images at the download limit as base64", async () => {
  const body = Buffer.alloc(LIMIT);
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(body, {
        headers: { "content-type": "image/png", "content-length": String(LIMIT) },
      }),
  );
  expect((await webfetch({ url: "https://example.com/image" })).content).toEqual([
    { type: "image", data: body.toString("base64"), mimeType: "image/png" },
  ]);
});

it.each([
  { contentType: "image/png", length: undefined },
  { contentType: "image/png", length: "1" },
  { contentType: "text/plain", length: undefined },
  { contentType: "text/plain", length: "1" },
  { contentType: "text/html", length: undefined },
  { contentType: "text/html", length: "1" },
])(
  "cancels oversized $contentType streams with content-length $length",
  async ({ contentType, length }) => {
    const cancel = vi.fn();
    let chunks = 0;

    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunks++;
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
      cancel,
    });

    const headers = new Headers({ "content-type": contentType });

    if (length !== undefined) headers.set("content-length", length);
    vi.stubGlobal("fetch", async () => new Response(body, { headers }));

    await expect(webfetch({ url: "https://example.com/large" })).rejects.toThrow("5 MiB");
    expect(cancel).toHaveBeenCalledOnce();
    expect(chunks).toBeLessThanOrEqual(7);
    expect(body.locked).toBe(false);
  },
);

it("cancels advertised oversized downloads without reading the body", async () => {
  const cancel = vi.fn();
  const pull = vi.fn();
  const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 });
  vi.stubGlobal(
    "fetch",
    async () =>
      new Response(body, {
        headers: { "content-length": String(LIMIT + 1) },
      }),
  );

  await expect(webfetch({ url: "https://example.com/large" })).rejects.toThrow("5 MiB");
  expect(pull).not.toHaveBeenCalled();
  expect(cancel).toHaveBeenCalledOnce();
});

it("forwards cancellation and releases a stalled response reader", async () => {
  const abort = new AbortController();
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ cancel });
  const fetch = vi.fn(async () => new Response(body));
  vi.stubGlobal("fetch", fetch);
  const pending = webfetch({ url: "https://example.com/stalled" }, abort.signal);
  const rejected = expect(pending).rejects.toThrow("cancelled");
  await vi.waitFor(() => expect(body.locked).toBe(true));
  abort.abort(new Error("cancelled"));

  await rejected;
  expect(fetch).toHaveBeenCalledWith(new URL("https://example.com/stalled"), {
    signal: abort.signal,
  });
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});

it("cancels a response returned after the caller has already aborted", async () => {
  const abort = new AbortController();
  abort.abort(new Error("cancelled"));
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ cancel });
  vi.stubGlobal("fetch", async () => new Response(body));

  await expect(webfetch({ url: "https://example.com" }, abort.signal)).rejects.toThrow("cancelled");
  expect(cancel).toHaveBeenCalledOnce();
  expect(body.locked).toBe(false);
});

it("releases the response reader after stream failures", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.error(new Error("download failed"));
    },
  });

  vi.stubGlobal("fetch", async () => new Response(body));

  await expect(webfetch({ url: "https://example.com" })).rejects.toThrow("download failed");
  expect(body.locked).toBe(false);
});

it("rejects unsupported protocols before fetching", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(webfetch({ url: "file:///etc/passwd" })).rejects.toThrow("HTTP and HTTPS");
  expect(fetch).not.toHaveBeenCalled();
});
