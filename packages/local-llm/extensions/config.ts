import { readFileSync } from "node:fs";
import { join } from "node:path";

import { getAgentDir } from "@earendil-works/pi-coding-agent";

/**
 * Validated per-provider settings from the shared pi-local-llm config file.
 *
 * All fields are optional; each extension applies provider-specific defaults
 * for anything the user did not set. A provider is only registered when
 * `enabled` is explicitly `true` (opt-in).
 */
export interface ProviderConfig {
  /** Whether this provider's models should be registered. */
  enabled?: boolean;
  /** Base URL of the local provider server, e.g. "http://localhost:11434". */
  baseUrl?: string;
  /** Bearer token sent with requests to the provider. */
  apiKey?: string;
  /** Context window size in tokens, used when the provider does not report one. */
  contextLength?: number;
}

/**
 * Shape of the pi-local-llm config file. Provider entries are validated
 * lazily by `loadProviderConfig()` so unknown keys are ignored.
 */
export interface LocalLlmConfig {
  providers?: Record<string, unknown>;
}

/**
 * Absolute path of the shared config file in pi's agent directory
 * (`<agentDir>/pi-local-llm.json`, default `~/.pi/agent/`).
 *
 * `getAgentDir()` honors the `PI_CODING_AGENT_DIR` override, so custom
 * agent directory layouts are supported without extra configuration.
 */
export function getLocalLlmConfigPath(): string {
  return join(getAgentDir(), "pi-local-llm.json");
}

/**
 * Read the pi-local-llm config file.
 *
 * A missing or malformed file is treated as "no providers configured" so pi
 * starts cleanly even before the user creates the file.
 */
export function loadLocalLlmConfig(): LocalLlmConfig {
  let raw: string;
  try {
    raw = readFileSync(getLocalLlmConfigPath(), "utf8");
  } catch {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const record = parsed as Record<string, unknown>;
  if (
    typeof record.providers !== "object" ||
    record.providers === null ||
    Array.isArray(record.providers)
  ) {
    return {};
  }

  return { providers: record.providers as Record<string, unknown> };
}

/**
 * Load and validate settings for a single provider.
 *
 * Returns `undefined` when the provider has no entry, or an object containing
 * only the fields present with correct types. Invalid values are dropped
 * silently so extensions fall back to their defaults.
 */
export function loadProviderConfig(name: string): ProviderConfig | undefined {
  const entry = loadLocalLlmConfig().providers?.[name];
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return undefined;
  }

  const record = entry as Record<string, unknown>;
  const config: ProviderConfig = {};

  if (typeof record.enabled === "boolean") {
    config.enabled = record.enabled;
  }

  if (typeof record.baseUrl === "string" && record.baseUrl.trim().length > 0) {
    config.baseUrl = record.baseUrl;
  }

  if (typeof record.apiKey === "string" && record.apiKey.length > 0) {
    config.apiKey = record.apiKey;
  }

  if (
    typeof record.contextLength === "number" &&
    Number.isFinite(record.contextLength) &&
    record.contextLength > 0
  ) {
    config.contextLength = Math.floor(record.contextLength);
  }

  return config;
}
