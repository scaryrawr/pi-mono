import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadProviderConfig } from "./config.ts";

const DEFAULT_BASE_URL = "http://localhost:1337";
const DEFAULT_API_KEY = "osaurus";
const DEFAULT_CONTEXT_LENGTH = 131_072;
const MAX_TOKENS_CEILING = 32_768;

async function fetchOsaurusModels(baseUrl: string, apiKey: string) {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as {
      models: Array<{
        name: string;
        model?: string;
      }>;
    };
  } catch {
    return undefined;
  }
}

const osaurus = async function (pi: ExtensionAPI) {
  const config = loadProviderConfig("osaurus");
  if (config?.enabled !== true) return;

  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = config.apiKey ?? DEFAULT_API_KEY;
  const contextLength = config.contextLength ?? DEFAULT_CONTEXT_LENGTH;
  const maxTokens = Math.min(MAX_TOKENS_CEILING, Math.floor(contextLength / 4));

  const payload = await fetchOsaurusModels(baseUrl, apiKey);
  if (payload === undefined) return;

  pi.registerProvider("osaurus", {
    baseUrl: `${baseUrl}/v1`,
    apiKey,
    api: "openai-completions",
    models: payload.models.map((model) => ({
      id: model.name,
      name: model.model ?? model.name,
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: contextLength,
      maxTokens,
    })),
  });
};

export default osaurus;
export { osaurus };
