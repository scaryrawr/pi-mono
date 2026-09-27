import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { Type } from "typebox";
import { Value } from "typebox/value";

import { loadProviderConfig } from "./config.ts";

const DEFAULT_BASE_URL = "http://127.0.0.1:18181";

const DEFAULT_API_KEY = "geniex";

const DEFAULT_CONTEXT_LENGTH = 65_536;

const MAX_TOKENS_CEILING = 32_768;

const GenieXModelsSchema = Type.Object({
  data: Type.Array(
    Type.Object({
      id: Type.String(),
      context_length: Type.Optional(Type.Number()),
    }),
  ),
});

type GenieXModels = Static<typeof GenieXModelsSchema>;

async function fetchGenieXModels(
  baseUrl: string,
  apiKey: string,
): Promise<GenieXModels | undefined> {
  try {
    const response = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return undefined;
    }

    const payload: unknown = await response.json();

    return Value.Check(GenieXModelsSchema, payload) ? payload : undefined;
  } catch {
    return undefined;
  }
}

const geniex = async function (pi: ExtensionAPI) {
  const config = loadProviderConfig("geniex");

  if (config?.enabled !== true) return;

  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = config.apiKey ?? DEFAULT_API_KEY;

  const payload = await fetchGenieXModels(baseUrl, apiKey);

  if (payload === undefined) return;

  pi.registerProvider("geniex", {
    baseUrl: `${baseUrl}/v1`,
    apiKey,
    api: "openai-completions",
    models: payload.data.map((model) => {
      const contextLength = model.context_length ?? config.contextLength ?? DEFAULT_CONTEXT_LENGTH;

      return {
        id: model.id,
        name: model.id,
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: contextLength,
        maxTokens: Math.min(MAX_TOKENS_CEILING, Math.floor(contextLength / 4)),
      };
    }),
  });
};

export default geniex;

export { geniex };
