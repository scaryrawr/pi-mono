import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import * as path from "node:path";

import {
  getAgentDir,
  type ExtensionAPI,
  type ExtensionContext,
  type InputEventResult,
  type ToolCallEvent,
  type ToolResultEvent,
  type ToolResultEventResult,
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { Compile } from "typebox/compile";

import type { PluginResources } from "./plugin.js";

const hookDocumentSchema = Compile(
  Type.Intersect([
    Type.Record(Type.String(), Type.Unknown()),
    Type.Object({
      hooks: Type.Optional(Type.Unknown()),
      disableAllHooks: Type.Optional(Type.Unknown()),
      version: Type.Optional(Type.Unknown()),
    }),
  ]),
);

const hookListSchema = Compile(Type.Array(Type.Unknown()));

const hookGroupSchema = Compile(
  Type.Object({ hooks: Type.Optional(Type.Unknown()), matcher: Type.Optional(Type.Unknown()) }),
);

const hookHandlerSchema = Compile(
  Type.Object({
    type: Type.Optional(Type.Unknown()),
    async: Type.Optional(Type.Unknown()),
    exec: Type.Optional(Type.Unknown()),
    command: Type.Optional(Type.Unknown()),
    commandWindows: Type.Optional(Type.Unknown()),
    bash: Type.Optional(Type.Unknown()),
    powershell: Type.Optional(Type.Unknown()),
    args: Type.Optional(Type.Unknown()),
    env: Type.Optional(Type.Unknown()),
    cwd: Type.Optional(Type.Unknown()),
    timeoutSec: Type.Optional(Type.Unknown()),
    timeout: Type.Optional(Type.Unknown()),
    matcher: Type.Optional(Type.Unknown()),
  }),
);

const stringSchema = Compile(Type.String());
const argsSchema = Compile(Type.Array(Type.String()));

const envSchema = Compile(Type.Record(Type.String({ pattern: "^[\\s\\S]*$" }), Type.String()));

const timeoutSchema = Compile(Type.Number({ exclusiveMinimum: 0 }));
const replacementArguments = Type.Record(Type.String(), Type.Unknown());
const replacementArgumentsSchema = Compile(replacementArguments);

const rawOutput = Type.Object({
  hookSpecificOutput: Type.Optional(Type.Unknown()),
  systemMessage: Type.Optional(Type.Unknown()),
  permissionDecision: Type.Optional(Type.Unknown()),
  permissionDecisionReason: Type.Optional(Type.Unknown()),
  reason: Type.Optional(Type.Unknown()),
  decision: Type.Optional(Type.Unknown()),
  continue: Type.Optional(Type.Unknown()),
  modifiedArgs: Type.Optional(Type.Unknown()),
  modifiedResult: Type.Optional(Type.Unknown()),
  modifiedTransformedPrompt: Type.Optional(Type.Unknown()),
  additionalContext: Type.Optional(Type.Unknown()),
});

const outputSchema = Compile(rawOutput);

const specificOutputSchema = Compile(
  Type.Object({
    hookEventName: Type.Optional(Type.Unknown()),
    permissionDecision: Type.Optional(Type.Unknown()),
    permissionDecisionReason: Type.Optional(Type.Unknown()),
    updatedInput: Type.Optional(Type.Unknown()),
    additionalContext: Type.Optional(Type.Unknown()),
  }),
);

const modifiedResultSchema = Compile(
  Type.Object({
    textResultForLlm: Type.Optional(Type.Unknown()),
    resultType: Type.Optional(Type.Unknown()),
  }),
);

const progressSchema = Compile(
  Type.Object({ type: Type.Literal("progress"), message: Type.Optional(Type.Unknown()) }),
);

const aliases = new Map<string, string>(
  Object.entries({
    sessionStart: "SessionStart",
    sessionEnd: "SessionEnd",
    userPromptSubmitted: "UserPromptSubmit",
    userPromptTransformed: "UserPromptTransformed",
    preToolUse: "PreToolUse",
    postToolUse: "PostToolUse",
    postToolUseFailure: "PostToolUseFailure",
    agentStop: "Stop",
    errorOccurred: "ErrorOccurred",
    preCompact: "PreCompact",
    notification: "Notification",
  }),
);

const supported = new Set([...aliases.values(), "PostCompact", "Interrupt"]);

interface ToolNameAliases {
  bash: "Bash";
  powershell: "Bash";
  read: "Read";
  write: "Write";
  edit: "Edit";
  grep: "Grep";
  find: "Glob";
  [name: string]: string | undefined;
}

const toolAliases: ToolNameAliases = {
  bash: "Bash",
  powershell: "Bash",
  read: "Read",
  write: "Write",
  edit: "Edit",
  grep: "Grep",
  find: "Glob",
};

interface HookCommand {
  command: string;
  exec?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeout?: number;
}

interface HookFields {
  source?: string;
  trigger?: string;
  reason?: string;
  tool_name?: string;
  tool_input?: ToolCallEvent["input"];
  tool_use_id?: string;
  tool_response?: { resultType: string; textResultForLlm: string };
  pi_tool_response?: Pick<ToolResultEvent, "content" | "structuredContent" | "isError">;
  tool_result?: { result_type: string; text_result_for_llm: string };
  pi_codex_only?: boolean;
  pi_failure_only?: boolean;
  prompt?: string;
  transformed_prompt?: string;
  custom_instructions?: string;
  error?: string | { message: string; name: string };
  error_context?: string;
  recoverable?: boolean;
  stop_hook_active?: boolean;
  stop_reason?: string;
  last_assistant_message?: string | null;
  notification_type?: string;
  title?: string;
  message?: string;
}

interface HookPayload {
  [key: string]: HookFields[keyof HookFields] | number | null;
}

interface Hook {
  plugin: PluginResources;
  event: string;
  name: string;
  camel: boolean;
  codex: boolean;
  matcher?: RegExp;
  handler: HookCommand;
}

export interface HookOutput {
  context: string;
  block?: string | undefined;
  stop?: boolean | undefined;
  args?: Static<typeof replacementArguments>;
  prompt?: string | undefined;
  result?: string | undefined;
  failedResult?: boolean | undefined;
}

/** Parse each handler independently; unsupported capabilities never silently run. */
export function parseHooks(plugins: PluginResources[], warn: (message: string) => void): Hook[] {
  const result: Hook[] = [];

  for (const plugin of plugins)
    for (const source of plugin.hookSources ?? []) {
      if (!hookDocumentSchema.Check(source)) {
        warn(`Invalid hooks for ${plugin.name}`);
        continue;
      }

      if (source.disableAllHooks === true) continue;

      if (source.version !== undefined && source.version !== 1) {
        warn(`Unsupported hook version for ${plugin.name}`);
        continue;
      }

      const events = hookDocumentSchema.Check(source.hooks) ? source.hooks : source;

      for (const [name, groups] of Object.entries(events)) {
        if (["description", "version", "disableAllHooks"].includes(name)) continue;
        const event = aliases.get(name) ?? name;

        if (!supported.has(event)) {
          warn(`Unsupported hook event ${name} for ${plugin.name}`);
          continue;
        }

        if (!hookListSchema.Check(groups)) {
          warn(`Invalid hook list ${name} for ${plugin.name}`);
          continue;
        }

        for (const group of groups) {
          if (!hookGroupSchema.Check(group)) {
            warn(`Invalid hook ${name}`);
            continue;
          }

          const handlers = hookListSchema.Check(group.hooks) ? group.hooks : [group];

          for (const handler of handlers) {
            try {
              if (!hookHandlerSchema.Check(handler)) throw new Error("handler must be an object");

              if ((handler.type ?? "command") !== "command")
                throw new Error(`unsupported handler type ${String(handler.type)}`);

              if (handler.async === true)
                throw new Error("background hooks are not supported; use a synchronous command");

              const command =
                process.platform === "win32"
                  ? (handler.commandWindows ?? handler.powershell ?? handler.command)
                  : (handler.bash ?? handler.command);

              if (handler.exec !== undefined) {
                if (
                  !stringSchema.Check(handler.exec) ||
                  !handler.exec ||
                  handler.command !== undefined ||
                  handler.bash !== undefined ||
                  handler.powershell !== undefined
                )
                  throw new Error("invalid exec command");
              } else if (!stringSchema.Check(command) || !command)
                throw new Error("missing platform command");

              if (handler.args !== undefined && !argsSchema.Check(handler.args))
                throw new Error("invalid args");

              if (handler.env !== undefined && !envSchema.Check(handler.env))
                throw new Error("invalid env");

              if (handler.cwd !== undefined && !stringSchema.Check(handler.cwd))
                throw new Error("invalid cwd");
              const timeout = handler.timeoutSec ?? handler.timeout;

              if (
                timeout !== undefined &&
                (!timeoutSchema.Check(timeout) || !Number.isFinite(timeout))
              )
                throw new Error("invalid timeout");
              const pattern = group.matcher ?? handler.matcher;

              if (pattern !== undefined && !stringSchema.Check(pattern))
                throw new Error("invalid matcher");
              const codex = plugin.hookStyle === "codex";

              const normalized: HookCommand = {
                command: stringSchema.Check(command) ? command : "",
              };

              if (handler.exec !== undefined) normalized.exec = handler.exec;

              if (handler.args !== undefined) normalized.args = handler.args;

              if (handler.env !== undefined) normalized.env = handler.env;

              if (handler.cwd !== undefined) normalized.cwd = handler.cwd;

              if (timeout !== undefined) normalized.timeout = timeout;

              const hook: Hook = {
                plugin,
                event,
                name,
                camel: aliases.has(name),
                codex,
                handler: normalized,
              };

              if (pattern && pattern !== "*" && pattern !== "**")
                hook.matcher = new RegExp(codex ? pattern : `^(?:${pattern})$`);
              result.push(hook);
            } catch (error) {
              warn(`Skipping ${plugin.name} ${name} hook: ${String(error)}`);
            }
          }
        }
      }
    }

  return result;
}

const limit = 1024 * 1024;

export class HookRuntime {
  private hooks: Hook[] = [];
  private kills = new Set<() => void>();
  private closed = false;
  private generation = 0;
  constructor(private warn: (message: string) => void) {}
  load(plugins: PluginResources[]): void {
    this.cancel();
    this.hooks = parseHooks(plugins, this.warn);
    this.closed = false;
  }
  cancel(): void {
    this.generation++;

    for (const kill of this.kills) kill();
    this.kills.clear();
  }
  dispose(): void {
    this.closed = true;
    this.cancel();
    this.hooks = [];
  }

  private async execute(
    hook: Hook,
    payload: HookPayload,
    ctx: ExtensionContext,
  ): Promise<{ stdout: string; stderr: string; code: number; timedOut: boolean }> {
    const generation = this.generation;
    const h = hook.handler;

    const data = path.join(
      getAgentDir(),
      "plugin-data",
      createHash("sha256").update(hook.plugin.root).digest("hex"),
    );

    await mkdir(data, { recursive: true });

    if (this.closed || generation !== this.generation) throw new Error("Hook runtime changed");

    const command = h.command;
    const executable = h.exec || (process.platform === "win32" ? "powershell.exe" : "bash");

    const args = h.exec
      ? (h.args ?? [])
      : process.platform === "win32"
        ? ["-NoProfile", "-Command", command]
        : ["-c", command];

    const cwd = h.cwd?.replaceAll(
      /\$\{(?:PLUGIN|COPILOT_PLUGIN|CLAUDE_PLUGIN)_(ROOT|DATA)\}/g,
      (_placeholder, kind: string) => (kind === "ROOT" ? hook.plugin.root : data),
    );

    const short = hook.event === "SessionEnd" || hook.event === "Interrupt";
    const seconds = h.timeout ?? (hook.codex ? (short ? 1 : 600) : 30);

    return new Promise((resolve) => {
      const child = spawn(executable, args, {
        cwd: cwd ? path.resolve(ctx.cwd, cwd) : ctx.cwd,
        env: {
          ...process.env,
          ...h.env,
          PLUGIN_ROOT: hook.plugin.root,
          PLUGIN_DATA: data,
          COPILOT_PLUGIN_ROOT: hook.plugin.root,
          COPILOT_PLUGIN_DATA: data,
          CLAUDE_PLUGIN_ROOT: hook.plugin.root,
          CLAUDE_PLUGIN_DATA: data,
        },
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "",
        stderr = "",
        bytes = 0,
        timedOut = false,
        overflow = false;

      const kill = () => {
        if (!child.pid) return;

        try {
          if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
          else child.kill("SIGKILL");
        } catch {
          /* Already exited. */
        }
      };

      this.kills.add(kill);

      const timer = setTimeout(
        () => {
          timedOut = true;
          kill();
        },
        Math.min(seconds, hook.codex && short ? 3 : seconds) * 1000,
      );

      const signal =
        hook.event === "Interrupt" || hook.event === "SessionEnd" ? undefined : ctx.signal;

      signal?.addEventListener("abort", kill, { once: true });

      if (signal?.aborted) kill();

      const append = (chunk: Buffer, isError: boolean) => {
        bytes += chunk.length;

        if (bytes > limit) {
          overflow = true;
          kill();

          return;
        }

        if (isError) stderr += chunk.toString();
        else stdout += chunk.toString();
      };

      child.stdout.on("data", (chunk: Buffer) => append(chunk, false));
      child.stderr.on("data", (chunk: Buffer) => append(chunk, true));
      child.stdin.on("error", () => {});
      child.on("error", (error) => {
        stderr = String(error);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", kill);
        this.kills.delete(kill);
        resolve({
          stdout,
          stderr: overflow ? "Hook output exceeded 1 MiB" : stderr,
          code: overflow ? 1 : (code ?? 1),
          timedOut,
        });
      });
      child.stdin.end(JSON.stringify(payload));
    });
  }

  async run(event: string, fields: HookFields, ctx: ExtensionContext): Promise<HookOutput> {
    const generation = this.generation;
    const output: HookOutput = { context: "" };

    const invoke = async (hook: Hook): Promise<HookOutput> => {
      const tool = fields.tool_name ?? "";
      const canonical = toolAliases[tool] ?? tool;
      const match = fields.source ?? fields.trigger ?? fields.reason ?? "";

      if (
        hook.matcher &&
        ![
          "UserPromptSubmit",
          "UserPromptTransformed",
          "Stop",
          "Interrupt",
          "ErrorOccurred",
        ].includes(event)
      ) {
        const values = tool ? (hook.camel ? [tool] : [tool, canonical]) : [match];

        if (!values.some((value) => hook.matcher!.test(value))) return { context: "" };
      }

      const payload: HookPayload = {
        session_id: ctx.sessionManager.getSessionId(),
        transcript_path: ctx.sessionManager.getSessionFile() ?? null,
        cwd: ctx.cwd,
        hook_event_name: hook.name,
        model: ctx.model?.id ?? "",
        ...fields,
        timestamp: new Date().toISOString(),
      };

      if (tool) payload.tool_name = hook.camel ? tool : canonical;

      delete payload.pi_codex_only;
      delete payload.pi_failure_only;

      if (!hook.codex && event === "SessionEnd") payload.reason = "user_exit";

      if (!hook.codex && event === "SessionStart" && payload.source === "clear")
        payload.source = "new";

      if (!hook.codex && fields.tool_response) {
        const response = fields.tool_response;

        if (hook.camel) payload.tool_response = response;
        else {
          payload.tool_result = {
            result_type: response.resultType,
            text_result_for_llm: response.textResultForLlm,
          };
          delete payload.tool_response;
        }
      } else if (hook.codex && fields.pi_tool_response !== undefined)
        payload.tool_response = fields.pi_tool_response;
      delete payload.pi_tool_response;

      if (hook.camel) {
        const mapping = {
          session_id: "sessionId",
          transcript_path: "transcriptPath",
          tool_name: "toolName",
          tool_input: "toolArgs",
          tool_response: "toolResult",
          stop_reason: "stopReason",
          error_context: "errorContext",
          custom_instructions: "customInstructions",
          transformed_prompt: "transformedPrompt",
        };

        for (const [from, to] of Object.entries(mapping))
          if (from in payload) {
            payload[to] = payload[from];
            delete payload[from];
          }

        payload.timestamp = Date.now();

        if (event !== "Notification") delete payload.hook_event_name;
      }

      try {
        const result = await this.execute(hook, payload, ctx);

        if (
          this.closed ||
          generation !== this.generation ||
          (ctx.signal?.aborted && event !== "SessionEnd" && event !== "Interrupt")
        )
          return { context: "" };

        if (result.timedOut) {
          this.warn(`${hook.plugin.name} ${hook.name} timed out (fail-open)`);

          return { context: "" };
        }

        if (result.code !== 0) {
          this.warn(
            `${hook.plugin.name} ${hook.name} exited ${result.code}: ${result.stderr.slice(0, 2000)}`,
          );

          if (
            (event === "PreToolUse" && (!hook.codex || result.code === 2)) ||
            (hook.codex &&
              result.code === 2 &&
              ["UserPromptSubmit", "Stop", "PostToolUse"].includes(event))
          )
            return { context: "", block: result.stderr.trim() || "Blocked by plugin hook" };

          if (!hook.codex && event === "PostToolUseFailure" && result.code === 2)
            return { context: result.stdout.slice(0, 10000) };

          return { context: "" };
        }

        const stdout = result.stdout
          .split("\n")
          .filter((line) => {
            try {
              const progress: unknown = JSON.parse(line);

              if (progressSchema.Check(progress)) {
                if (ctx.hasUI)
                  ctx.ui.notify(
                    stringSchema.Check(progress.message) ? progress.message : "",
                    "info",
                  );

                return false;
              }
            } catch {
              /* Not progress. */
            }

            return true;
          })
          .join("\n")
          .trim();

        let parsed: unknown;

        try {
          parsed = JSON.parse(stdout || "{}");
        } catch {
          return {
            context:
              hook.codex && ["SessionStart", "UserPromptSubmit"].includes(event)
                ? stdout.slice(0, 10000)
                : "",
          };
        }

        if (!outputSchema.Check(parsed)) return { context: "" };

        const specific =
          specificOutputSchema.Check(parsed.hookSpecificOutput) &&
          (!parsed.hookSpecificOutput.hookEventName ||
            parsed.hookSpecificOutput.hookEventName === event)
            ? parsed.hookSpecificOutput
            : {};

        if (stringSchema.Check(parsed.systemMessage) && parsed.systemMessage) {
          if (ctx.hasUI) ctx.ui.notify(parsed.systemMessage, "warning");
          else this.warn(parsed.systemMessage);
        }

        const decision = specific.permissionDecision ?? parsed.permissionDecision;

        const reason =
          specific.permissionDecisionReason ?? parsed.permissionDecisionReason ?? parsed.reason;

        let block =
          decision === "deny" || parsed.decision === "block"
            ? (stringSchema.Check(reason) ? reason : "") || "Blocked by plugin hook"
            : undefined;

        if (decision === "ask") {
          const approvalReason =
            parsed.permissionDecisionReason ?? specific.permissionDecisionReason;

          block =
            !ctx.hasUI ||
            !(await ctx.ui.confirm(
              "Plugin hook approval",
              (stringSchema.Check(approvalReason) ? approvalReason : "") || tool,
            ))
              ? "Denied by plugin hook approval"
              : undefined;
        }

        if (
          !hook.codex &&
          ["PreCompact", "UserPromptSubmit", "SessionEnd", "ErrorOccurred"].includes(event)
        )
          return { context: "" };

        const args = hook.codex
          ? specific.permissionDecision === "allow"
            ? specific.updatedInput
            : undefined
          : (parsed.modifiedArgs ?? specific.updatedInput);

        const modified = modifiedResultSchema.Check(parsed.modifiedResult)
          ? parsed.modifiedResult
          : {};

        const additionalContext = specific.additionalContext ?? parsed.additionalContext;

        const next: HookOutput = {
          context: (stringSchema.Check(additionalContext) ? additionalContext : "").slice(0, 10000),
          block,
          stop: parsed.continue === false,
          prompt: stringSchema.Check(parsed.modifiedTransformedPrompt)
            ? parsed.modifiedTransformedPrompt || undefined
            : undefined,
          result: stringSchema.Check(modified.textResultForLlm)
            ? modified.textResultForLlm.slice(0, limit)
            : undefined,
          failedResult: modified.resultType === "failure",
        };

        if (replacementArgumentsSchema.Check(args)) next.args = args;

        return next;
      } catch (error) {
        this.warn(`${hook.plugin.name} ${hook.name}: ${String(error)}`);

        const failed: HookOutput = { context: "" };

        if (!hook.codex && event === "PreToolUse" && !this.closed && generation === this.generation)
          failed.block = "Plugin hook failed";

        return failed;
      }
    };

    // Codex handlers start concurrently; Copilot handlers run in declaration order.
    const matching = this.hooks.filter(
      (hook) =>
        hook.event === event &&
        (!fields.pi_codex_only || hook.codex) &&
        (!fields.pi_failure_only || hook.codex),
    );

    const merge = (next: HookOutput) => {
      if (next.context)
        output.context = [output.context, next.context]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 10000);

      if (next.block) output.block = next.block;

      if (next.stop) output.stop = true;

      if (next.args) output.args = next.args;

      if (next.prompt) output.prompt = next.prompt;

      if (next.result !== undefined) {
        output.result = next.result;
        output.failedResult = next.failedResult;
      }
    };

    const codex = matching.filter((hook) => hook.codex).map(invoke);

    for (const hook of matching.filter((item) => !item.codex)) {
      if (generation !== this.generation || this.closed) break;
      merge(await invoke(hook));
    }

    for (const next of await Promise.all(codex)) merge(next);

    return output;
  }
}

/** Register once, replace definitions on discovery, and release processes on shutdown. */
export function registerHooks(pi: ExtensionAPI, runtime: HookRuntime): void {
  let context = "",
    continuations = 0,
    trigger = "manual";

  const queue = (value: string) => {
    if (value) context = [context, value].filter(Boolean).join("\n\n").slice(0, 10000);
  };

  pi.on("session_start", async (event, ctx) => {
    context = "";
    continuations = 0;

    const source =
      event.reason === "new" || event.reason === "fork"
        ? "clear"
        : event.reason === "resume" || ctx.sessionManager.getBranch().length > 0
          ? "resume"
          : "startup";

    queue((await runtime.run("SessionStart", { source }, ctx)).context);
  });
  pi.on("session_shutdown", async (_event, ctx) => {
    runtime.cancel();

    try {
      await runtime.run("SessionEnd", { reason: "other" }, ctx);
    } finally {
      runtime.dispose();
      context = "";
    }
  });
  pi.on("input", async (event, ctx) => {
    continuations = 0;
    const output = await runtime.run("UserPromptSubmit", { prompt: event.text }, ctx);

    if (output.block || output.stop) {
      if (ctx.hasUI) ctx.ui.notify(output.block ?? "Prompt stopped by plugin hook", "warning");

      return { action: "handled" };
    }

    queue(output.context);

    const transformed = await runtime.run(
      "UserPromptTransformed",
      { prompt: event.text, transformed_prompt: event.text },
      ctx,
    );

    if (transformed.prompt) {
      const result: InputEventResult = {
        action: "transform",
        text: transformed.prompt,
      };

      if (event.images) result.images = event.images;

      return result;
    }

    return undefined;
  });
  pi.on("before_agent_start", () => {
    if (!context) return;
    const content = context;
    context = "";

    return { message: { customType: "plugin-hooks", content, display: false } };
  });
  pi.on("context", (event) => {
    if (!context) return;
    const content = context;
    context = "";

    return {
      messages: [
        ...event.messages,
        {
          role: "custom",
          customType: "plugin-hooks",
          content,
          display: false,
          timestamp: Date.now(),
        },
      ],
    };
  });
  pi.on("tool_call", async (event, ctx) => {
    const output = await runtime.run(
      "PreToolUse",
      { tool_name: event.toolName, tool_input: event.input, tool_use_id: event.toolCallId },
      ctx,
    );

    queue(output.context);

    if (output.block) return { block: true, reason: output.block };

    if (output.args) {
      // Pi does not revalidate hook mutations; reject unsafe object keys before replacement.
      if (
        Object.keys(output.args).some((key) =>
          ["__proto__", "constructor", "prototype"].includes(key),
        )
      )
        return { block: true, reason: "Unsafe hook argument keys" };
      const tool = pi.getAllTools().find((item) => item.name === event.toolName);

      try {
        if (!tool || !Compile(tool.parameters).Check(output.args))
          return { block: true, reason: "Invalid hook replacement arguments" };
      } catch {
        return { block: true, reason: "Cannot validate hook replacement arguments" };
      }

      for (const key of Object.keys(event.input)) {
        if (!Reflect.deleteProperty(event.input, key))
          throw new TypeError(`Cannot delete hook argument ${key}`);
      }

      Object.assign(event.input, output.args);
    }
  });
  pi.on("tool_result", async (event, ctx) => {
    const rendered = event.content
      .filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("\n");

    if (event.isError)
      await runtime.run(
        "ErrorOccurred",
        {
          error: { message: rendered, name: "ToolError" },
          error_context: "tool_execution",
          recoverable: true,
        },
        ctx,
      );

    const response: Pick<ToolResultEvent, "content" | "structuredContent" | "isError"> = {
      content: event.content,
      isError: event.isError,
    };

    if (event.structuredContent !== undefined) response.structuredContent = event.structuredContent;

    const fields = {
      tool_name: event.toolName,
      tool_input: event.input,
      tool_use_id: event.toolCallId,
      tool_response: {
        resultType: event.isError ? "failure" : "success",
        textResultForLlm: rendered,
      },
      pi_tool_response: response,
      error: rendered,
    };

    // Codex PostToolUse includes failures; Copilot has a separate failure event.
    const output = await runtime.run(
      event.isError ? "PostToolUseFailure" : "PostToolUse",
      fields,
      ctx,
    );

    if (event.isError) {
      const codex = await runtime.run("PostToolUse", { ...fields, pi_failure_only: true }, ctx);
      output.context = [output.context, codex.context].filter(Boolean).join("\n\n");
      output.block ??= codex.block;
      output.stop ||= codex.stop;
    }

    if (output.context && output.result === undefined && !output.block && !output.stop) {
      const result: ToolResultEventResult = {
        content: [...event.content, { type: "text", text: output.context }],
        details: event.details,
        isError: event.isError,
      };

      if (event.structuredContent !== undefined) result.structuredContent = event.structuredContent;

      return result;
    }

    if (output.result !== undefined || output.block || output.stop) {
      const replacement =
        output.block ??
        (output.stop ? "Tool output stopped by plugin hook" : (output.result ?? rendered));

      return {
        content: [
          { type: "text", text: [replacement, output.context].filter(Boolean).join("\n\n") },
        ],
        details: undefined,
        isError: output.block
          ? true
          : output.result !== undefined
            ? (output.failedResult ?? false)
            : event.isError,
      };
    }
  });
  pi.on("session_before_compact", async (event, ctx) => {
    trigger = event.reason === "manual" ? "manual" : "auto";

    const output = await runtime.run(
      "PreCompact",
      { trigger, custom_instructions: event.customInstructions ?? "" },
      ctx,
    );

    queue(output.context);

    if (output.stop) return { cancel: true };
  });
  pi.on("session_compact", async (event, ctx) => {
    trigger = event.reason === "manual" ? "manual" : "auto";
    queue((await runtime.run("PostCompact", { trigger }, ctx)).context);
    queue(
      (await runtime.run("SessionStart", { source: "compact", pi_codex_only: true }, ctx)).context,
    );
  });
  pi.on("session_compact_failed", async (event, ctx) => {
    if (event.errorMessage)
      await runtime.run(
        "ErrorOccurred",
        {
          error: { message: event.errorMessage, name: "CompactionError" },
          error_context: "system",
          recoverable: true,
        },
        ctx,
      );
  });
  pi.on("agent_before_settle", async (event, ctx) => {
    if (event.outcome === "aborted") {
      await runtime.run("Interrupt", {}, ctx);

      return;
    }

    if (event.outcome === "error") {
      await runtime.run(
        "ErrorOccurred",
        {
          error: { message: "Agent run failed", name: "AgentError" },
          error_context: "model_call",
          recoverable: false,
        },
        ctx,
      );

      return;
    }

    const messages = event.context.contextMessages;
    const last = [...messages].reverse().find((message) => message.role === "assistant");

    const output = await runtime.run(
      "Stop",
      {
        stop_hook_active: continuations > 0,
        stop_reason: "end_turn",
        last_assistant_message:
          last?.role === "assistant"
            ? last.content
                .filter((item) => item.type === "text")
                .map((item) => item.text)
                .join("\n")
            : null,
      },
      ctx,
    );

    queue(output.context);

    if (output.block && !output.stop && continuations < 8 && event.context.canContinue) {
      continuations++;

      return {
        continue: true,
        entries: [
          ...event.entries,
          {
            type: "custom_message",
            customType: "plugin-hook-continuation",
            content: output.block,
            display: false,
          },
        ],
      };
    }
  });
  pi.on("ui_prompt_start", async (event, ctx) => {
    queue(
      (
        await runtime.run(
          "Notification",
          {
            notification_type: "elicitation_dialog",
            title: event.title ?? "",
            message: event.title ?? event.kind,
          },
          ctx,
        )
      ).context,
    );
  });
}
