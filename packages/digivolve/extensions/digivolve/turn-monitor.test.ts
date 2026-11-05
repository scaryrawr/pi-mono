import path from "node:path";

import { describe, expect, it } from "vitest";

import { isRepositoryCorrection, TurnMonitor } from "./turn-monitor.js";

const cwd = path.resolve("test-repository");

describe("repository corrections", () => {
  it.each([
    "This repository uses pnpm, not npm.",
    "Next time, run pnpm check before committing.",
    "Please remember to follow AGENTS.md.",
    "You ignored the setup instructions in README.md.",
  ])("recognizes repository-specific corrections: %s", (prompt) => {
    expect(isRepositoryCorrection(prompt)).toBe(true);
  });

  it.each([
    "Please add a test for this feature.",
    "The tests failed; fix the bug.",
    "You keep making mistakes.",
    "Remember to be concise.",
    "Read package.json and run validation.",
  ])("ignores ordinary requests and generic frustration: %s", (prompt) => {
    expect(isRepositoryCorrection(prompt)).toBe(false);
  });

  it("bounds prompt inspection", () => {
    expect(isRepositoryCorrection(`${"x".repeat(8192)} Next time, run pnpm check.`)).toBe(false);
  });
});

describe("TurnMonitor", () => {
  it("does not collect evidence before a user turn starts", () => {
    const monitor = new TurnMonitor();
    monitor.recordFailure("pnpm test --bad", "unknown option", cwd);
    monitor.recordSuccess("pnpm test", cwd);
    monitor.markReflectionIssued();

    expect(monitor.hasEvidence).toBe(false);
    expect(monitor.reflectionIssued).toBe(false);
    expect(monitor.claimReflection()).toBe(false);
  });

  it("claims a correction once and resets on the next prompt", () => {
    const monitor = new TurnMonitor();
    monitor.start("This repo uses pnpm.");

    expect(monitor.hasEvidence).toBe(true);
    expect(monitor.claimReflection()).toBe(true);
    expect(monitor.reflectionIssued).toBe(true);
    expect(monitor.claimReflection()).toBe(false);

    monitor.start("Implement the feature.");

    expect(monitor.hasEvidence).toBe(false);
    expect(monitor.reflectionIssued).toBe(false);
    expect(monitor.claimReflection()).toBe(false);
  });

  it("marks manual reflection consumed even when evidence arrives later", () => {
    const monitor = new TurnMonitor();
    monitor.start("Implement the feature.");
    monitor.markReflectionIssued();
    monitor.recordFailure("pnpm test --bad", "unknown option", cwd);
    monitor.recordSuccess("pnpm test", cwd);

    expect(monitor.hasEvidence).toBe(true);
    expect(monitor.claimReflection()).toBe(false);
  });

  it("does not trigger for successful validation alone or an ordinary test failure", () => {
    const monitor = new TurnMonitor();
    monitor.start("Implement the feature.");
    monitor.recordSuccess("pnpm test", cwd);
    expect(monitor.claimReflection()).toBe(false);

    monitor.recordFailure("pnpm test", "Expected 1, received 2", cwd);
    monitor.recordSuccess("pnpm test --run", cwd);
    expect(monitor.claimReflection()).toBe(false);
  });

  it("detects a recovered validation command usage error against the same target", () => {
    const monitor = new TurnMonitor();
    monitor.start("Validate the change.");
    monitor.recordFailure("pnpm test ./src/example.test.ts --bad", "unknown option --bad", cwd);
    monitor.recordSuccess("pnpm test ./src/example.test.ts --run", cwd);

    expect(monitor.claimReflection()).toBe(true);
    expect(monitor.claimReflection()).toBe(false);
  });

  it("detects repeated validation failures followed by a changed successful command", () => {
    const monitor = new TurnMonitor();
    monitor.start("Validate the change.");
    monitor.recordFailure("pnpm test", "test failed", cwd);
    monitor.recordFailure("pnpm test", "test failed again", cwd);
    monitor.recordSuccess("pnpm test --run", cwd);

    expect(monitor.claimReflection()).toBe(true);
  });

  it("ignores successful retries of an unchanged command, including whitespace changes", () => {
    const monitor = new TurnMonitor();
    monitor.start("Validate the change.");
    monitor.recordFailure("pnpm test --bad", "unknown option", cwd);
    monitor.recordFailure("pnpm test --bad", "unknown option", cwd);
    monitor.recordSuccess("  pnpm  test   --bad  ", cwd);

    expect(monitor.hasEvidence).toBe(false);
  });

  it("does not correlate different repository targets", () => {
    const monitor = new TurnMonitor();
    monitor.start("Validate the change.");
    monitor.recordFailure("pnpm test ./src/first.test.ts --bad", "unknown option", cwd);
    monitor.recordSuccess("pnpm test ./src/second.test.ts", cwd);

    expect(monitor.hasEvidence).toBe(false);
  });

  it.each(["../outside.test.ts", "https://example.com/test.ts"])(
    "ignores nonlocal operations: %s",
    (target) => {
      const monitor = new TurnMonitor();
      monitor.start("Validate the change.");
      monitor.recordFailure(`pnpm test ${target} --bad`, "unknown option", cwd);
      monitor.recordFailure(`pnpm test ${target} --bad`, "unknown option", cwd);
      monitor.recordSuccess(`pnpm test ${target}`, cwd);

      expect(monitor.hasEvidence).toBe(false);
    },
  );

  it("requires both failed and recovered operations to be validation-like", () => {
    const monitor = new TurnMonitor();
    monitor.start("Implement the feature.");
    monitor.recordFailure("echo --bad", "unknown option", cwd);
    monitor.recordSuccess("pnpm test", cwd);
    expect(monitor.hasEvidence).toBe(false);

    monitor.recordFailure("pnpm test --bad", "unknown option", cwd);
    monitor.recordSuccess("echo done", cwd);
    expect(monitor.hasEvidence).toBe(false);
  });

  it("does not carry failed operations across user prompts", () => {
    const monitor = new TurnMonitor();
    monitor.start("Validate the change.");
    monitor.recordFailure("pnpm test --bad", "unknown option", cwd);
    monitor.start("Validate another change.");
    monitor.recordSuccess("pnpm test", cwd);

    expect(monitor.hasEvidence).toBe(false);
  });
});
