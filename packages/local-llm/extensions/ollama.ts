import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY ?? "ollama";

const OLLAMA_CONTEXT_LENGTH = parseContextLength(process.env.OLLAMA_CONTEXT_LENGTH) ?? 131_072;
const OLLAMA_MAX_TOKENS = Math.min(32_768, Math.floor(OLLAMA_CONTEXT_LENGTH / 4));

function parseContextLength(value: string | undefined) {
  if (value === undefined) return undefined;

  const contextLength = Number.parseInt(value, 10);
  if (!Number.isFinite(contextLength) || contextLength <= 0) {
    return undefined;
  }

  return contextLength;
}

async function fetchOllamaModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      headers: { Authorization: `Bearer ${OLLAMA_API_KEY}` },
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

export default async function (pi: ExtensionAPI) {
  const payload = await fetchOllamaModels();
  if (payload === undefined) return;

  pi.registerProvider("ollama", {
    baseUrl: `${OLLAMA_BASE_URL}/v1`,
    apiKey: OLLAMA_API_KEY,
    api: "openai-completions",
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
