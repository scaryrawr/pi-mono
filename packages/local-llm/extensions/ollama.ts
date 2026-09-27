import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { Static } from "typebox";
import { Type } from "typebox";
import { Value } from "typebox/value";

import { loadProviderConfig } from "./config.ts";

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

type OllamaTags = Static<typeof OllamaTagsSchema>;

async function fetchOllamaModels(baseUrl: string, apiKey: string): Promise<OllamaTags | undefined> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      return undefined;
    }

    const payload: unknown = await response.json();

    return Value.Check(OllamaTagsSchema, payload) ? payload : undefined;
  } catch {
    return undefined;
  }
}

const ollama = async function (pi: ExtensionAPI) {
  const config = loadProviderConfig("ollama");

  if (config?.enabled !== true) return;

  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const apiKey = config.apiKey ?? DEFAULT_API_KEY;
  const contextLength = config.contextLength ?? DEFAULT_CONTEXT_LENGTH;
  const maxTokens = Math.min(MAX_TOKENS_CEILING, Math.floor(contextLength / 4));

  const payload = await fetchOllamaModels(baseUrl, apiKey);

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
