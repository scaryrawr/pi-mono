import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import type {
  AgentBeforeSettleEvent,
  ExtensionAPI,
  ExtensionContext,
  ExtensionEvent,
  ExtensionHandler,
  ToolResultEvent,
  ToolResultEventResult,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { afterEach, expect, it, vi } from "vitest";

import { HookRuntime, parseHooks, registerHooks } from "./hooks.js";
import { loadPlugin, type PluginResources } from "./plugin.js";

const roots: string[] = [];

type HookFixture =
  | string
  | number
  | boolean
  | null
  | HookFixture[]
  | { [key: string]: HookFixture };

afterEach(async () => {
  vi.unstubAllEnvs();

  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture(style: "copilot" | "codex" = "copilot") {
  const root = await mkdtemp(path.join(tmpdir(), "pi-hooks-"));
  roots.push(root);
  vi.stubEnv("PI_CODING_AGENT_DIR", root);
  await mkdir(path.join(root, ".codex-plugin"));
  await writeFile(
    path.join(root, style === "codex" ? ".codex-plugin/plugin.json" : "plugin.json"),
    '{"name":"fixture"}',
  );

  const context: Pick<ExtensionContext, "cwd" | "hasUI"> & {
    sessionManager: Pick<
      ExtensionContext["sessionManager"],
      "getSessionId" | "getSessionFile" | "getBranch"
    >;
  } = {
    cwd: root,
    hasUI: false,
    sessionManager: {
      getSessionId: () => "session",
      getSessionFile: () => undefined,
      getBranch: () => [],
    },
  };

  // SAFETY: runtime tests access only cwd, hasUI, sessionManager's three methods, and absent signal/model.
  const ctx = context as ExtensionContext;

  return { root, ctx };
}

function plugin(
  root: string,
  hooks: HookFixture,
  style: "copilot" | "codex" = "copilot",
): PluginResources {
  return {
    root,
    name: "fixture",
    skillPaths: [],
    promptPaths: [],
    hookStyle: style,
    hookSources: [hooks],
  };
}

const emit = (value: HookFixture) => `printf '%s' '${JSON.stringify(value)}'`;

it("discovers both defaults, inline and explicit hook sources without escaping plugin roots", async () => {
  const { root } = await fixture();
  await mkdir(path.join(root, "hooks"));
  await writeFile(path.join(root, "hooks.json"), '{"version":1,"hooks":{}}');
  await writeFile(path.join(root, "hooks/hooks.json"), '{"hooks":{}}');
  expect((await loadPlugin(root)).hookSources).toHaveLength(2);
  await writeFile(
    path.join(root, "plugin.json"),
    JSON.stringify({
      name: "fixture",
      hooks: ["./missing.json", { hooks: {} }, "./hooks/hooks.json"],
    }),
  );
  const warn = vi.fn();
  expect((await loadPlugin(root, warn)).hookSources).toHaveLength(2);
  expect(warn).toHaveBeenCalledWith("Missing hook file ./missing.json");
  const outside = await fixture("codex");
  await symlink(
    path.join(outside.root, ".codex-plugin/plugin.json"),
    path.join(root, "escape.json"),
  );
  await writeFile(path.join(root, "plugin.json"), '{"name":"fixture","hooks":"./escape.json"}');
  expect((await loadPlugin(root, warn)).hookSources).toEqual([]);
  await mkdir(path.join(outside.root, "hooks"));
  await writeFile(path.join(outside.root, "hooks/hooks.json"), '{"hooks":{}}');
  expect((await loadPlugin(outside.root)).hookStyle).toBe("codex");
  expect((await loadPlugin(outside.root)).hookSources).toHaveLength(1);
});

it("loads ScaryPilot-style hooks and executes scripts from the expanded plugin cwd", async () => {
  const { root, ctx } = await fixture();
  await mkdir(path.join(root, "hooks"));
  await mkdir(path.join(root, "workspace"));
  ctx.cwd = path.join(root, "workspace");
  await mkdir(path.join(root, "skills"));
  await writeFile(
    path.join(root, "plugin.json"),
    JSON.stringify({ name: "anti-slop", skills: ["skills/"], hooks: "hooks/hooks.json" }),
  );
  await writeFile(
    path.join(root, "hooks/guard.cjs"),
    `process.stdout.write(JSON.stringify({permissionDecision:"deny",permissionDecisionReason:process.cwd()}));`,
  );
  await writeFile(
    path.join(root, "hooks/hooks.json"),
    JSON.stringify({
      version: 1,
      hooks: {
        preToolUse: [
          {
            matcher: "edit",
            exec: process.execPath,
            args: ["hooks/guard.cjs"],
            cwd: "${PLUGIN_ROOT}",
            timeoutSec: 10,
          },
        ],
      },
    }),
  );
  const warnings: string[] = [];
  const runtime = new HookRuntime((message) => warnings.push(message));

  try {
    const loaded = await loadPlugin(root, (message) => warnings.push(message));
    expect(loaded.hookSources).toHaveLength(1);
    runtime.load([loaded]);
    expect(
      await runtime.run("PreToolUse", { tool_name: "edit", tool_input: { path: "test.ts" } }, ctx),
    ).toMatchObject({ block: await realpath(root) });
    expect(warnings).toEqual([]);
  } finally {
    runtime.dispose();
  }
});

it("rejects absolute, escaping and symlinked hook paths while retaining valid siblings", async () => {
  const { root } = await fixture();
  const outside = await fixture("codex");
  await writeFile(path.join(root, "good.json"), '{"hooks":{}}');
  await symlink(
    path.join(outside.root, ".codex-plugin/plugin.json"),
    path.join(root, "escape.json"),
  );
  await writeFile(
    path.join(root, "plugin.json"),
    JSON.stringify({
      name: "fixture",
      hooks: [path.join(root, "good.json"), "../plugin.json", "escape.json", "good.json"],
    }),
  );
  const warnings: string[] = [];
  expect((await loadPlugin(root, (message) => warnings.push(message))).hookSources).toEqual([
    { hooks: {} },
  ]);
  expect(warnings).toHaveLength(3);
});

it("expands plugin root and data aliases only in hook cwd", async () => {
  const { root, ctx } = await fixture();
  const runtime = new HookRuntime(vi.fn());

  try {
    for (const alias of [
      "PLUGIN_ROOT",
      "COPILOT_PLUGIN_ROOT",
      "CLAUDE_PLUGIN_ROOT",
      "PLUGIN_DATA",
      "COPILOT_PLUGIN_DATA",
      "CLAUDE_PLUGIN_DATA",
    ]) {
      runtime.load([
        plugin(root, {
          hooks: {
            sessionStart: [
              {
                exec: process.execPath,
                args: [
                  "-e",
                  `process.stdout.write(JSON.stringify({additionalContext:process.cwd()}));`,
                ],
                cwd: `\${${alias}}`,
              },
            ],
          },
        }),
      ]);
      const output = await runtime.run("SessionStart", { source: "startup" }, ctx);

      if (alias.endsWith("ROOT")) expect(output.context).toBe(await realpath(root));
      else expect(output.context).toContain("plugin-data");
    }
  } finally {
    runtime.dispose();
  }
});

it("isolates malformed handlers, unsupported events/types, invalid regex and disabled sources", async () => {
  const { root } = await fixture();
  const warn = vi.fn();

  const hooks = parseHooks(
    [
      plugin(root, {
        hooks: {
          PreToolUse: [
            { hooks: [null, { type: "http" }, { command: "true" }] },
            { matcher: "[", command: "true" },
          ],
          PermissionRequest: [],
        },
      }),
      plugin(root, { disableAllHooks: true, hooks: { Stop: [{ command: "false" }] } }),
    ],
    warn,
  );

  expect(hooks).toHaveLength(1);
  expect(warn).toHaveBeenCalledTimes(4);
});

it("passes JSON stdin, literal env and persistent plugin paths with exec", async () => {
  const { root, ctx } = await fixture();
  await writeFile(
    path.join(root, "peer.cjs"),
    `let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{const p=JSON.parse(input);process.stdout.write(JSON.stringify({additionalContext:JSON.stringify({p,root:process.env.PLUGIN_ROOT,data:process.env.PLUGIN_DATA,literal:process.env.LITERAL,cwd:process.cwd()})}));});`,
  );
  const runtime = new HookRuntime(vi.fn());
  runtime.load([
    plugin(root, {
      version: 1,
      hooks: {
        sessionStart: [
          {
            exec: process.execPath,
            args: [path.join(root, "peer.cjs")],
            env: { LITERAL: "!echo no ${UNSET}" },
          },
        ],
      },
    }),
  ]);
  const output = await runtime.run("SessionStart", { source: "startup" }, ctx);
  const data = JSON.parse(output.context);
  expect(data.p.sessionId).toBe("session");
  expect(data.p.timestamp).toEqual(expect.any(Number));
  expect(data.p.session_id).toBeUndefined();
  expect(data.root).toBe(root);
  expect(data.data).toContain("plugin-data");
  expect(data.literal).toBe("!echo no ${UNSET}");
  expect(data.cwd).toBe(await realpath(root));
  runtime.dispose();
});

it("isolates invalid handler fields while retaining nullish defaults and unused platform commands", async () => {
  const { root } = await fixture();
  const warn = vi.fn();

  const hooks = parseHooks(
    [
      plugin(root, {
        hooks: {
          PreToolUse: [
            { command: "true", args: [1] },
            { command: "true", env: { "line\nbreak": 1 } },
            { command: "true", cwd: null },
            { command: "true", timeout: 0 },
            { command: "true", matcher: null },
            { command: "true", type: null, timeoutSec: null, timeout: 2 },
            process.platform === "win32"
              ? { command: "true", bash: 42 }
              : { command: "true", commandWindows: 42 },
          ],
        },
      }),
    ],
    warn,
  );

  expect(hooks).toHaveLength(2);
  expect(warn).toHaveBeenCalledTimes(5);
});

it("keeps tolerant output fields independent and ignores specific output for another event", async () => {
  const { root, ctx } = await fixture();
  const runtime = new HookRuntime(vi.fn());
  runtime.load([
    plugin(root, {
      hooks: {
        PostToolUse: [
          {
            command: emit({
              additionalContext: "retained",
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                additionalContext: "ignored",
                permissionDecision: "deny",
              },
              modifiedArgs: [],
              modifiedResult: { resultType: "failure", textResultForLlm: 7 },
              modifiedTransformedPrompt: false,
              systemMessage: ["ignored"],
            }),
          },
        ],
      },
    }),
  ]);

  expect(await runtime.run("PostToolUse", {}, ctx)).toEqual({
    context: "retained",
  });
  runtime.dispose();
});

it("uses tool aliases, Codex decisions, Copilot result rewrites and progress stripping", async () => {
  const { root, ctx } = await fixture();
  const runtime = new HookRuntime(vi.fn());
  runtime.load([
    plugin(
      root,
      {
        hooks: {
          PreToolUse: [
            {
              matcher: "^Bash$",
              hooks: [
                {
                  command: emit({
                    hookSpecificOutput: {
                      hookEventName: "PreToolUse",
                      permissionDecision: "deny",
                      permissionDecisionReason: "policy",
                    },
                  }),
                },
              ],
            },
          ],
        },
      },
      "codex",
    ),
  ]);
  expect((await runtime.run("PreToolUse", { tool_name: "bash", tool_input: {} }, ctx)).block).toBe(
    "policy",
  );
  expect((await runtime.run("PreToolUse", { tool_name: "read" }, ctx)).block).toBeUndefined();
  runtime.load([
    plugin(root, {
      hooks: {
        postToolUse: [
          {
            matcher: "bash",
            command: `echo '{"type":"progress","message":"check"}'; ${emit({ modifiedResult: { resultType: "success", textResultForLlm: "redacted" }, additionalContext: "notes" })}`,
          },
        ],
      },
    }),
  ]);
  expect(await runtime.run("PostToolUse", { tool_name: "bash" }, ctx)).toMatchObject({
    result: "redacted",
    context: "notes",
  });
  runtime.dispose();
});

it("fails closed for Copilot command errors, open for Codex errors and all timeouts", async () => {
  const { root, ctx } = await fixture();
  const warn = vi.fn();
  const runtime = new HookRuntime(warn);

  for (const style of ["copilot", "codex"] as const) {
    runtime.load([plugin(root, { hooks: { PreToolUse: [{ command: "exit 1" }] } }, style)]);
    expect(Boolean((await runtime.run("PreToolUse", {}, ctx)).block)).toBe(style === "copilot");
  }

  runtime.load([
    plugin(root, { hooks: { PreToolUse: [{ command: "echo policy >&2; exit 2" }] } }, "codex"),
  ]);
  expect((await runtime.run("PreToolUse", {}, ctx)).block).toBe("policy");
  runtime.load([plugin(root, { hooks: { PreToolUse: [{ command: "sleep 5", timeout: 0.02 }] } })]);
  expect((await runtime.run("PreToolUse", {}, ctx)).block).toBeUndefined();
  runtime.dispose();
  expect(warn).toHaveBeenCalled();
});

it("bounds output and cancels old invocations when definitions are replaced", async () => {
  const { root, ctx } = await fixture();
  const runtime = new HookRuntime(vi.fn());
  runtime.load([
    plugin(root, {
      hooks: {
        PreToolUse: [
          { exec: process.execPath, args: ["-e", "process.stdout.write('x'.repeat(2*1024*1024))"] },
        ],
      },
    }),
  ]);
  expect((await runtime.run("PreToolUse", {}, ctx)).block).toBeDefined();
  runtime.load([plugin(root, { hooks: { SessionStart: [{ command: "sleep 5" }] } })]);
  const running = runtime.run("SessionStart", { source: "startup" }, ctx);
  await new Promise((resolve) => setTimeout(resolve, 20));
  runtime.load([]);
  expect(await running).toEqual({ context: "" });
  runtime.dispose();
});

it("starts all matching Codex hooks concurrently and merges in declaration order", async () => {
  const { root, ctx } = await fixture();
  const runtime = new HookRuntime(vi.fn());
  runtime.load([
    plugin(
      root,
      {
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  command: `for i in $(seq 1 50); do test -f "$PLUGIN_ROOT/started" && break; sleep .01; done; test -f "$PLUGIN_ROOT/started" && ${emit({ additionalContext: "first" })}`,
                },
                {
                  command: `touch "$PLUGIN_ROOT/started"; ${emit({ additionalContext: "second" })}`,
                },
              ],
            },
          ],
        },
      },
      "codex",
    ),
  ]);
  expect((await runtime.run("SessionStart", { source: "startup" }, ctx)).context).toBe(
    "first\n\nsecond",
  );
  expect(await readFile(path.join(root, "started"), "utf8")).toBe("");
  runtime.dispose();
});

it("maps Pi input, validated tool mutations, result redaction, compaction, and bounded continuations", async () => {
  const { root, ctx } = await fixture();

  interface TestHookResult {
    content?: { type: string; text: string }[];
    structuredContent?: HookFixture;
    continue?: boolean;
  }

  type Handler = (
    event: Partial<ExtensionEvent>,
    ctx: ExtensionContext,
  ) => Promise<TestHookResult | undefined>;

  const handlers = new Map<string, Handler>();

  const api: Pick<ExtensionAPI, "on" | "getAllTools"> = {
    on: (name, handler) => {
      // SAFETY: tests invoke each captured handler only with its event's accessed fields and inspect only content/continue.
      handlers.set(name, handler as Handler);

      return () => {
        handlers.delete(name);
      };
    },
    getAllTools: () => [
      {
        name: "bash",
        description: "Test shell",
        parameters: Type.Object({ command: Type.String() }),
        exposure: "direct",
        sourceInfo: { path: root, source: "fixture", scope: "temporary", origin: "top-level" },
      },
    ],
  };

  // SAFETY: registration only calls on/getAllTools; fixture events supply the members each invoked handler reads.
  const pi = api as ExtensionAPI;

  const runtime = new HookRuntime(vi.fn());
  registerHooks(pi, runtime);
  runtime.load([
    plugin(
      root,
      {
        hooks: {
          UserPromptSubmit: [{ command: emit({ decision: "block", reason: "secret" }) }],
          PreToolUse: [
            {
              command: emit({
                hookSpecificOutput: {
                  permissionDecision: "allow",
                  updatedInput: { command: "safe" },
                },
              }),
            },
          ],
          PostToolUse: [{ command: emit({ decision: "block", reason: "redacted" }) }],
          PreCompact: [{ command: emit({ continue: false }) }],
          Stop: [{ command: emit({ decision: "block", reason: "check" }) }],
        },
      },
      "codex",
    ),
  ]);
  expect(await handlers.get("input")!({ text: "secret" }, ctx)).toEqual({ action: "handled" });

  const call = {
    toolName: "bash",
    input: { command: "original", timeout: 10 },
    toolCallId: "call",
  };

  await handlers.get("tool_call")!(call, ctx);
  expect(call.input).toEqual({ command: "safe" });

  const result = await handlers.get("tool_result")!(
    {
      ...call,
      content: [{ type: "text", text: "secret" }],
      structuredContent: { secret: true },
      isError: false,
    },
    ctx,
  );

  expect(result!.content).toEqual([{ type: "text", text: "redacted" }]);
  expect(result!.structuredContent).toBeUndefined();
  expect(await handlers.get("session_before_compact")!({ reason: "manual" }, ctx)).toEqual({
    cancel: true,
  });

  const boundary: AgentBeforeSettleEvent = {
    type: "agent_before_settle",
    outcome: "completed",
    entries: [],
    continue: false,
    context: {
      canContinue: true,
      contextMessages: [],
      contextEntries: [],
      llmMessages: [],
      pendingMessages: [],
    },
  };

  for (let i = 0; i < 8; i++)
    expect((await handlers.get("agent_before_settle")!(boundary, ctx))!.continue).toBe(true);
  expect(await handlers.get("agent_before_settle")!(boundary, ctx)).toBeUndefined();
  runtime.dispose();
});

it("preserves image content and metadata when hooks only append context", async () => {
  const { root, ctx } = await fixture();
  let handler: ExtensionHandler<ToolResultEvent, ToolResultEventResult> | undefined;

  const api: Pick<ExtensionAPI, "on"> = {
    on: (name, callback) => {
      if (name === "tool_result") {
        // SAFETY: this callback is registered for tool_result and invoked with that event below.
        handler = callback as ExtensionHandler<ToolResultEvent, ToolResultEventResult>;
      }

      return () => {};
    },
  };

  const runtime = new HookRuntime(vi.fn());
  // SAFETY: registering hooks only uses on; getAllTools is only used by tool_call handlers.
  registerHooks(api as ExtensionAPI, runtime);
  runtime.load([
    plugin(root, {
      hooks: {
        postToolUse: [{ command: emit({ additionalContext: "notes" }) }],
        postToolUseFailure: [{ command: emit({ additionalContext: "notes" }) }],
      },
    }),
  ]);

  try {
    for (const isError of [false, true]) {
      const image: ToolResultEvent["content"][number] = {
        type: "image",
        data: "AA==",
        mimeType: "image/png",
      };

      const contents: ToolResultEvent["content"][] = [
        [image],
        [{ type: "text", text: "caption" }, image],
      ];

      for (const content of contents) {
        const event: ToolResultEvent = {
          type: "tool_result",
          toolName: "read",
          toolCallId: "image",
          input: { path: "image.png" },
          content,
          details: { metadata: "retained" },
          structuredContent: { imageId: "retained" },
          isError,
        };

        expect(await handler!(event, ctx)).toEqual({
          content: [...content, { type: "text", text: "notes" }],
          details: event.details,
          structuredContent: event.structuredContent,
          isError,
        });
        expect(event.content).toEqual(content);
      }
    }
  } finally {
    runtime.dispose();
  }
});
