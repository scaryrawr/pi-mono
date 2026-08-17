import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { loadProviderConfig } from "./config.ts";

const DEFAULT_BASE_URL = "http://localhost:8000";
const DEFAULT_API_KEY = "omlx";

function isLLM(engineType: string): engineType is "llm" | "vlm" {
  return engineType === "llm" || engineType === "vlm";
}

async function fetchOMLXModels(baseUrl: string, apiKey: string) {
  try {
    const response = await fetch(`${baseUrl}/v1/models/status`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as {
      models: Array<{
        id: string;
        max_context_window: number;
        max_tokens: number;
        model_type: "vlm" | "llm" | (string & {});
        engine_type: "batched" | "llm" | "vlm" | (string & {});
      }>;
    };
  } catch {
    return undefined;
  }
}

const omlx = async function (pi: ExtensionAPI) {
  const config = loadProviderConfig("omlx");
  if (config?.enabled !== true) return;

  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = config.apiKey ?? DEFAULT_API_KEY;

  const payload = await fetchOMLXModels(baseUrl, apiKey);
  if (payload === undefined) return;

  pi.registerProvider("omlx", {
    baseUrl: `${baseUrl}/v1`,
    apiKey,
    api: "openai-completions",
    models: payload.models
      .filter((m) => isLLM(m.model_type))
      .map((model) => {
        return {
          id: model.id,
          name: model.id,
          reasoning: true,
          input: ["text", "image"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: model.max_context_window,
          maxTokens: model.max_tokens,
        };
      }),
  });
};

export default omlx;
export { omlx };
