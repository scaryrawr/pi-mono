import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { it, vi } from "vitest";

import { globalConfigPath, readConfig } from "./config.js";
import extension from "./index.js";
import { marketplaceRoot } from "./marketplace.js";
import { loadPlugin } from "./plugin.js";

it("adds an already cloned Codex marketplace to global config and can load its plugins", async () => {
  const agent = await mkdtemp(path.join(tmpdir(), "pi-codex-marketplace-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", agent);

  try {
    const source = "https://github.com/scaryrawr/scarydex";
    const root = marketplaceRoot(source);
    await mkdir(path.join(root, ".agents/plugins"), { recursive: true });
    await mkdir(path.join(root, "plugins/decide/.codex-plugin"), { recursive: true });
    await mkdir(path.join(root, "plugins/decide/skills/decide"), { recursive: true });
    await writeFile(
      path.join(root, ".agents/plugins/marketplace.json"),
      JSON.stringify({
        name: "scarydex",
        plugins: [{ name: "decide", source: { source: "local", path: "./plugins/decide" } }],
      }),
    );
    await writeFile(
      path.join(root, "plugins/decide/.codex-plugin/plugin.json"),
      '{"name":"decide"}',
    );
    await writeFile(
      path.join(root, "plugins/decide/skills/decide/SKILL.md"),
      "---\nname: decide\ndescription: Make decisions\n---\n",
    );
    let command: Parameters<ExtensionAPI["registerCommand"]>[1] | undefined;

    const pi: Partial<ExtensionAPI> = {
      registerCommand: (_name: string, value: NonNullable<typeof command>) => {
        command = value;
      },
      on: () => () => {},
    };

    // SAFETY: this test runs only command registration and event subscription on the partial API.
    extension(pi as ExtensionAPI);
    const select = vi.fn().mockResolvedValueOnce("Add marketplace").mockResolvedValueOnce("Done");
    const notify = vi.fn();

    const ctx: Pick<ExtensionCommandContext, "hasUI" | "cwd"> & {
      ui: Partial<ExtensionCommandContext["ui"]>;
    } = {
      hasUI: true,
      cwd: agent,
      ui: { select, input: async () => source, notify },
    };

    // SAFETY: the command accesses only hasUI, cwd, and ui.select/input/notify on this context.
    await command!.handler("", ctx as ExtensionCommandContext);
    assert.deepEqual(await readConfig(globalConfigPath()), {
      plugins: [],
      marketplaces: [{ source, enabled: [] }],
    });
    assert.equal(notify.mock.calls[0]![0], "Added scarydex (1 plugins, all disabled)");
    assert.equal((await loadPlugin(path.join(root, "plugins/decide"))).skillPaths.length, 1);
    // Retrying the add reuses the checkout without duplicating configuration.
    select.mockResolvedValueOnce("Add marketplace").mockResolvedValueOnce("Done");
    // SAFETY: the same command still only accesses hasUI, cwd, and ui.select/input/notify.
    await command!.handler("", ctx as ExtensionCommandContext);
    assert.equal((await readConfig(globalConfigPath())).marketplaces.length, 1);
  } finally {
    vi.unstubAllEnvs();
    await rm(agent, { recursive: true, force: true });
  }
});
