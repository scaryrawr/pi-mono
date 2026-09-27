import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { Type } from "typebox";
import { Value } from "typebox/value";

/**
 * Validated per-provider settings from the shared pi-local-llm config file.
 *
 * All fields are optional; each extension applies provider-specific defaults
 * for anything the user did not set. A provider is only registered when
 * `enabled` is explicitly `true` (opt-in).
 */
const ProviderConfigSchema = Type.Object({
  /** Whether this provider's models should be registered. */
  enabled: Type.Optional(Type.Boolean()),
  /** Base URL of the local provider server, e.g. "http://localhost:11434". */
  baseUrl: Type.Optional(Type.String({ pattern: "\\S" })),
  /** Bearer token sent with requests to the provider. */
  apiKey: Type.Optional(Type.String({ minLength: 1 })),
  /** Context window size in tokens, used when the provider does not report one. */
  contextLength: Type.Optional(Type.Number({ minimum: 1 })),
});

export type ProviderConfig = Static<typeof ProviderConfigSchema>;

/**
 * Shape of the pi-local-llm config file. Unknown top-level keys and unknown
 * per-provider fields are tolerated so round-trips do not drop user data;
 * only `providers` entries are validated by `loadProviderConfig()`.
 */
const ConfigFileSchema = Type.Object({
  providers: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

type ConfigFile = Static<typeof ConfigFileSchema>;

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
function readConfigFile(): ConfigFile {
  try {
    const parsed: unknown = JSON.parse(readFileSync(getLocalLlmConfigPath(), "utf8"));

    return Value.Check(ConfigFileSchema, parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Load and validate settings for a single provider.
 *
 * Returns `undefined` when the provider has no entry, or an object containing
 * only the fields present with correct types. Invalid values are dropped
 * silently so extensions fall back to their defaults.
 */
export function loadProviderConfig(name: string): ProviderConfig | undefined {
  const entry: unknown = readConfigFile().providers?.[name];

  return Value.Check(ProviderConfigSchema, entry) ? entry : undefined;
}

/**
 * Set a provider's `enabled` flag in the config file.
 *
 * Preserves all other existing fields (`baseUrl`, `apiKey`, `contextLength`,
 * unknown keys). Creates the file (and agent directory) when missing.
 */
export function setProviderEnabled(name: string, enabled: boolean): void {
  const config = readConfigFile();

  const providers = config.providers ?? {};

  const entry: unknown = providers[name];

  providers[name] = Value.Check(ProviderConfigSchema, entry) ? { ...entry, enabled } : { enabled };

  const path = getLocalLlmConfigPath();

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ ...config, providers }, null, 2)}\n`, "utf8");
}
