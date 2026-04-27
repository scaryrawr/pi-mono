import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL ?? "http://localhost:1234";

async function fetchLmStudioModels() {
  try {
    const response = await fetch(`${LMSTUDIO_BASE_URL}/api/v1/models`);
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
  } catch (error) {
    return undefined;
  }
}

export default async function (pi: ExtensionAPI) {
  const payload = await fetchLmStudioModels();
  if (payload === undefined) return;

  pi.registerProvider("lmstudio", {
    baseUrl: `${LMSTUDIO_BASE_URL}/v1`,
    apiKey: "LOCAL_OPENAI_API_KEY",
    api: "openai-completions",
    models: payload.models.map((model) => ({
      id: model.key ?? model.key,
      name: model.display_name ?? model.key,
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.max_context_length ?? 131_072,
      maxTokens: model.max_context_length
        ? Math.min(32_768, Math.floor(model.max_context_length / 4))
        : 32_768,
    })),
  });
}
