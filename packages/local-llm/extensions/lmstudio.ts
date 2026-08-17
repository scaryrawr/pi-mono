import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadProviderConfig } from "./config.ts";

const DEFAULT_BASE_URL = "http://localhost:1234";
const DEFAULT_API_KEY = "lmstudio";
const DEFAULT_CONTEXT_LENGTH = 131_072;
const MAX_TOKENS_CEILING = 32_768;

async function fetchLmStudioModels(baseUrl: string, apiKey: string) {
  try {
    const response = await fetch(`${baseUrl}/api/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as {
      models: Array<{
        key: string;
        display_name?: string;
        max_context_length?: number;
      }>;
    };
  } catch {
    return undefined;
  }
}

const lmstudio = async function (pi: ExtensionAPI) {
  const config = loadProviderConfig("lmstudio");
  if (config?.enabled !== true) return;

  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = config.apiKey ?? DEFAULT_API_KEY;

  const payload = await fetchLmStudioModels(baseUrl, apiKey);
  if (payload === undefined) return;

  pi.registerProvider("lmstudio", {
    baseUrl: `${baseUrl}/v1`,
    apiKey,
    api: "openai-completions",
    models: payload.models.map((model) => {
      const contextLength = model.max_context_length ?? DEFAULT_CONTEXT_LENGTH;
      return {
        id: model.key,
        name: model.display_name ?? model.key,
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: contextLength,
        maxTokens: Math.min(MAX_TOKENS_CEILING, Math.floor(contextLength / 4)),
      };
    }),
  });
};

export default lmstudio;
export { lmstudio };
