import { Type } from "typebox";
import { afterEach, expect, it, vi } from "vitest";

import { fetchModelCatalog } from "./discovery.ts";

const schema = Type.Object({ models: Type.Array(Type.String()) });
const url = "http://localhost:1234/models";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("validates model catalogs and clears the discovery timer", async () => {
  vi.useFakeTimers();
  const fetch = vi.fn(async () => Response.json({ models: ["local-model"] }));
  vi.stubGlobal("fetch", fetch);

  expect(await fetchModelCatalog(url, "secret", schema)).toEqual({ models: ["local-model"] });
  expect(fetch).toHaveBeenCalledWith(url, {
    headers: { Authorization: "Bearer secret" },
    signal: expect.any(AbortSignal),
  });
  expect(vi.getTimerCount()).toBe(0);
});

it.each(["invalid json", '{"models":[1]}'])(
  "silently skips malformed catalogs: %s",
  async (body) => {
    vi.stubGlobal("fetch", async () => new Response(body));
    expect(await fetchModelCatalog(url, "secret", schema)).toBeUndefined();
  },
);

it("cancels HTTP error bodies and silently skips unavailable servers", async () => {
  const cancel = vi.fn();
  vi.stubGlobal("fetch", async () => new Response(new ReadableStream({ cancel }), { status: 503 }));
  expect(await fetchModelCatalog(url, "secret", schema)).toBeUndefined();
  expect(cancel).toHaveBeenCalledOnce();

  vi.stubGlobal("fetch", async () => {
    throw new Error("connection refused");
  });
  expect(await fetchModelCatalog(url, "secret", schema)).toBeUndefined();
});

it("bounds stalled response headers", async () => {
  vi.useFakeTimers();
  const aborted = vi.fn();
  vi.stubGlobal(
    "fetch",
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener(
          "abort",
          () => {
            aborted();
            reject(init.signal?.reason);
          },
          { once: true },
        );
      }),
  );
  const pending = fetchModelCatalog(url, "secret", schema);

  await vi.advanceTimersByTimeAsync(5000);
  expect(await pending).toBeUndefined();
  expect(aborted).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("uses the same deadline for headers and a stalled JSON body", async () => {
  vi.useFakeTimers();
  const aborted = vi.fn();
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"models":['));
          init.signal?.addEventListener(
            "abort",
            () => {
              aborted();
              controller.error(init.signal?.reason);
            },
            { once: true },
          );
        },
      }),
    );
  });
  const pending = fetchModelCatalog(url, "secret", schema);

  await vi.advanceTimersByTimeAsync(4999);
  expect(aborted).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(await pending).toBeUndefined();
  expect(aborted).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
