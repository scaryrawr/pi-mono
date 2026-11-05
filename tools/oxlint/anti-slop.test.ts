import { execFile } from "node:child_process";
import { readdirSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { expect, it } from "vitest";

const run = promisify(execFile);
const source = new URL("./anti-slop/", import.meta.url);

const cases = readdirSync(source, { recursive: true, encoding: "utf8" }).filter((file) =>
  file.endsWith(".test.ts"),
);

it.each(cases)("%s", async (file) => {
  await run(process.execPath, [fileURLToPath(new URL(file, source))]);
});

it.each(["../../", "../../packages/copilot/"])("loads shared rules from %s", async (directory) => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "pi-shared-oxlint-"));
  const fixture = join(fixtureRoot, "example.ts");
  const config = fileURLToPath(new URL("../../.oxlintrc.json", import.meta.url));
  const cwd = fileURLToPath(new URL(directory, import.meta.url));
  const args = ["exec", "oxlint", "--config", config, "--format", "json", fixture];

  try {
    await writeFile(
      fixture,
      'export function example(value: unknown) { return typeof value === "string" ? value : ""; }\n',
    );

    await expect(run("pnpm", args, { cwd })).rejects.toMatchObject({
      code: 1,
      stdout: expect.stringContaining("no-runtime-typeof"),
    });

    await writeFile(fixture, "export function example(value: string) { return value; }\n");
    await run("pnpm", args, { cwd });
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
