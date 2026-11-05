import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

import { loadProviderConfig } from "./config.ts";
import { fetchModelCatalog } from "./discovery.ts";

const DEFAULT_BASE_URL = "http://localhost:11434";

const DEFAULT_API_KEY = "ollama";

const DEFAULT_CONTEXT_LENGTH = 131_072;

const MAX_TOKENS_CEILING = 32_768;

const OllamaTagsSchema = Type.Object({
  models: Type.Array(
    Type.Object({
      name: Type.String(),
      model: Type.Optional(Type.String()),
    }),
  ),
});

const ollama = async function (pi: ExtensionAPI) {
  const config = loadProviderConfig("ollama");

  if (config?.enabled === false) return;

  const baseUrl = config?.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = config?.apiKey ?? DEFAULT_API_KEY;
  const contextLength = config?.contextLength ?? DEFAULT_CONTEXT_LENGTH;
  const maxTokens = Math.min(MAX_TOKENS_CEILING, Math.floor(contextLength / 4));

  const payload = await fetchModelCatalog(`${baseUrl}/api/tags`, apiKey, OllamaTagsSchema);

  if (payload === undefined) return;

  pi.registerProvider("ollama", {
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

export default ollama;

export { ollama };
