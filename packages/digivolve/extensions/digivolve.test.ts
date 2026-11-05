import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  SessionManager,
  type ExtensionAPI,
  type ExtensionCommandContext,
  type ExtensionContext,
  type ExtensionHandler,
  type SessionShutdownEvent,
} from "@earendil-works/pi-coding-agent";
import { afterEach, expect, it, vi } from "vitest";

import digivolve from "./digivolve.js";

let directory: string | undefined;
let shutdown: (() => Promise<void>) | undefined;

afterEach(async () => {
  await shutdown?.();
  shutdown = undefined;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();

  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

async function fixture(startDelay: number) {
  directory = await mkdtemp(join(tmpdir(), "digivolve-lifecycle-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", directory);

  const fetch = vi.fn(() => {
    throw new Error("Unexpected network request");
  });

  vi.stubGlobal("fetch", fetch);
  const log = join(directory, "lifecycle.log");
  await mkdir(join(directory, "extensions"));
  await writeFile(
    join(directory, "extensions", "lifecycle.ts"),
    `
import { appendFile } from "node:fs/promises";
export default function(pi) {
  const log = ${JSON.stringify(log)};
  pi.on("session_start", async () => {
    await appendFile(log, "start\\n");
    await new Promise(resolve => setTimeout(resolve, ${startDelay}));
  });
  pi.on("resources_discover", async () => {
    await appendFile(log, "discover\\n");
  });
  pi.on("input", async () => {
    await appendFile(log, "prompt\\n");
    return { action: "handled" };
  });
  pi.on("session_shutdown", async () => {
    await appendFile(log, "shutdown\\n");
  });
}
`,
  );

  let command: Parameters<ExtensionAPI["registerCommand"]>[1] | undefined;
  let onShutdown: ExtensionHandler<SessionShutdownEvent> | undefined;

  const api: Pick<ExtensionAPI, "on" | "registerCommand" | "getThinkingLevel"> = {
    on: (name, handler) => {
      if (name === "session_shutdown") {
        // SAFETY: this callback is registered for session_shutdown and called with that event below.
        onShutdown = handler as ExtensionHandler<SessionShutdownEvent>;
      }

      return () => {};
    },
    registerCommand: (_name, options) => {
      command = options;
    },
    getThinkingLevel: () => "off",
  };

  // SAFETY: digivolve's factory only uses on, registerCommand, and getThinkingLevel.
  digivolve(api as ExtensionAPI);

  const sessionManager = SessionManager.inMemory(directory);
  sessionManager.appendMessage({
    role: "user",
    content: "Review this repository",
    timestamp: Date.now(),
  });

  const context: Pick<
    ExtensionContext,
    "cwd" | "sessionManager" | "hasUI" | "isProjectTrusted" | "getSystemPrompt"
  > & {
    ui: Pick<ExtensionContext["ui"], "notify">;
  } = {
    cwd: directory,
    sessionManager,
    hasUI: false,
    isProjectTrusted: () => true,
    getSystemPrompt: () => "Test reflection session",
    ui: { notify: vi.fn() },
  };

  // SAFETY: reflection commands only access the context fields supplied above; no command-only actions are used.
  const ctx = context as ExtensionCommandContext;
  shutdown = async () => {
    await onShutdown!({ type: "session_shutdown", reason: "quit" }, ctx);
  };

  return {
    run: async () => {
      await command!.handler("force", ctx);
    },
    events: async () => (await readFile(log, "utf8")).trim().split("\n"),
    fetch,
  };
}

it("starts extensions, discovers resources, and shuts them down for every reflection", async () => {
  const test = await fixture(0);

  for (let i = 0; i < 2; i++) {
    await test.run();
    await vi.waitFor(async () =>
      expect((await test.events()).filter((event) => event === "shutdown")).toHaveLength(i + 1),
    );
  }

  expect(await test.events()).toEqual([
    "start",
    "discover",
    "prompt",
    "shutdown",
    "start",
    "discover",
    "prompt",
    "shutdown",
  ]);
  expect(test.fetch).not.toHaveBeenCalled();
});

it("cleans up cancellation during extension startup without prompting", async () => {
  const test = await fixture(200);
  await test.run();
  await vi.waitFor(async () => expect(await test.events()).toEqual(["start"]));
  await shutdown!();

  expect(await test.events()).toEqual(["start", "discover", "shutdown"]);
  expect(test.fetch).not.toHaveBeenCalled();
});
