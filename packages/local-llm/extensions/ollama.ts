import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const OLLAMA_CONTEXT_LENGTH = parseContextLength(process.env.OLLAMA_CONTEXT_LENGTH) ?? 262_144;
const OLLAMA_MAX_TOKENS = Math.min(16_384, Math.floor(OLLAMA_CONTEXT_LENGTH / 4));

function parseContextLength(value: string | undefined) {
  if (value === undefined) return undefined;

  const contextLength = Number.parseInt(value, 10);
  if (!Number.isFinite(contextLength) || contextLength <= 0) {
    console.warn(`Ignoring invalid OLLAMA_CONTEXT_LENGTH: ${value}`);
    return undefined;
  }

  return contextLength;
}

async function fetchOllamaModels() {
  try {
    const response = await fetch("http://localhost:11434/api/tags");
    if (!response.ok) {
      console.warn(
        `Skipping Ollama provider registration: failed to fetch models (${response.status} ${response.statusText})`,
      );
      return undefined;
    }

    return (await response.json()) as {
      models: Array<{
        name: string;
        model?: string;
      }>;
    };
  } catch (error) {
    console.warn("Skipping Ollama provider registration: failed to fetch models", error);
    return undefined;
  }
}

export default async function (pi: ExtensionAPI) {
  const payload = await fetchOllamaModels();
  if (payload === undefined) return;

  pi.registerProvider("ollama", {
    baseUrl: "http://localhost:11434/v1",
    apiKey: "ollama",
    api: "openai-responses",
    models: payload.models.map((model) => ({
      id: model.name,
      name: model.model ?? model.name,
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: OLLAMA_CONTEXT_LENGTH,
      maxTokens: OLLAMA_MAX_TOKENS,
    })),
  });
}
