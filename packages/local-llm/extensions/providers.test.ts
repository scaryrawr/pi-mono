import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import geniex from "./geniex.ts";
import lmstudio from "./lmstudio.ts";
import ollama from "./ollama.ts";
import omlx from "./omlx.ts";
import osaurus from "./osaurus.ts";

const providers = [
  { name: "ollama", factory: ollama, path: "/api/tags", payload: { models: [{ name: "test" }] } },
  { name: "osaurus", factory: osaurus, path: "/api/tags", payload: { models: [{ name: "test" }] } },
  {
    name: "lmstudio",
    factory: lmstudio,
    path: "/api/v1/models",
    payload: { models: [{ key: "test" }] },
  },
  { name: "geniex", factory: geniex, path: "/v1/models", payload: { data: [{ id: "test" }] } },
  {
    name: "omlx",
    factory: omlx,
    path: "/v1/models/status",
    payload: {
      models: [{ id: "test", model_type: "llm", max_context_window: 8192, max_tokens: 2048 }],
    },
  },
];

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "pi-local-discovery-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", directory);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  await rm(directory, { recursive: true, force: true });
});

it.each(providers)(
  "discovers $name with its own API shape and a deadline",
  async ({ name, factory, path, payload }) => {
    await writeFile(
      join(directory, "pi-local-llm.json"),
      JSON.stringify({
        providers: { [name]: { baseUrl: "https://models.example", apiKey: "secret" } },
      }),
    );
    const fetch = vi.fn(async () => Response.json(payload));
    vi.stubGlobal("fetch", fetch);
    const registerProvider = vi.fn();
    const api: Pick<ExtensionAPI, "registerProvider"> = { registerProvider };

    // SAFETY: provider factories only access registerProvider on the extension API.
    await factory(api as ExtensionAPI);

    expect(fetch).toHaveBeenCalledWith(`https://models.example${path}`, {
      headers: { Authorization: "Bearer secret" },
      signal: expect.any(AbortSignal),
    });
    expect(registerProvider).toHaveBeenCalledWith(
      name,
      expect.objectContaining({
        baseUrl: "https://models.example/v1",
        models: [expect.objectContaining({ id: "test" })],
      }),
    );
  },
);

it.each(providers)("does not fetch or register disabled $name", async ({ name, factory }) => {
  await writeFile(
    join(directory, "pi-local-llm.json"),
    JSON.stringify({
      providers: { [name]: { enabled: false } },
    }),
  );
  const fetch = vi.fn();
  const registerProvider = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const api: Pick<ExtensionAPI, "registerProvider"> = { registerProvider };

  // SAFETY: provider factories only access registerProvider on the extension API.
  await factory(api as ExtensionAPI);

  expect(fetch).not.toHaveBeenCalled();
  expect(registerProvider).not.toHaveBeenCalled();
});
