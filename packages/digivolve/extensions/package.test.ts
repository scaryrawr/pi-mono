import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent";
import { expect, it } from "vitest";

it("loads the scoped package's extension and skill through Pi resource discovery", async () => {
  const directory = await mkdtemp(join(tmpdir(), "digivolve-package-"));
  const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

  try {
    const resourceLoader = new DefaultResourceLoader({
      cwd: directory,
      agentDir: join(directory, "agent"),
      settingsManager: SettingsManager.inMemory(
        { packages: [packageDirectory] },
        { projectTrusted: true },
      ),
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
    });

    await resourceLoader.reload();

    const result = resourceLoader.getExtensions();
    expect(result.errors).toEqual([]);
    expect(result.extensions).toHaveLength(1);
    expect(result.extensions[0]?.commands.has("digivolve")).toBe(true);
    expect(resourceLoader.getSkills().diagnostics).toEqual([]);
    expect(resourceLoader.getSkills().skills.map((skill) => skill.name)).toEqual(["digivolution"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);
