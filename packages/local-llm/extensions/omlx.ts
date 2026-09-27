import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { Type } from "typebox";
import { Value } from "typebox/value";

import { loadProviderConfig } from "./config.ts";

const DEFAULT_BASE_URL = "http://localhost:8000";

const DEFAULT_API_KEY = "omlx";

function isLLM(modelType: string): boolean {
  return modelType === "llm" || modelType === "vlm";
}

const OmlxModelsSchema = Type.Object({
  models: Type.Array(
    Type.Object({
      id: Type.String(),
      max_context_window: Type.Number(),
      max_tokens: Type.Number(),
      model_type: Type.String(),
    }),
  ),
});

type OmlxModels = Static<typeof OmlxModelsSchema>;

async function fetchOMLXModels(baseUrl: string, apiKey: string): Promise<OmlxModels | undefined> {
  try {
    const response = await fetch(`${baseUrl}/v1/models/status`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const payload: unknown = await response.json();

    return Value.Check(OmlxModelsSchema, payload) ? payload : undefined;
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
    models: payload.models.flatMap((model) =>
      isLLM(model.model_type)
        ? [
            {
              id: model.id,
              name: model.id,
              reasoning: true,
              input: ["text", "image"],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: model.max_context_window,
              maxTokens: model.max_tokens,
            },
          ]
        : [],
    ),
  });
};

export default omlx;

export { omlx };
