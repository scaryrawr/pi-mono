import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

async function fetchLmStudioModels() {
  try {
    const response = await fetch("http://localhost:1234/api/v1/models");
    if (!response.ok) {
      console.warn(
        `Skipping LM Studio provider registration: failed to fetch models (${response.status} ${response.statusText})`,
      );
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
    console.warn("Skipping LM Studio provider registration: failed to fetch models", error);
    return undefined;
  }
}

export default async function (pi: ExtensionAPI) {
  const payload = await fetchLmStudioModels();
  if (payload === undefined) return;

  pi.registerProvider("lmstudio", {
    baseUrl: "http://localhost:1234/v1",
    apiKey: "LOCAL_OPENAI_API_KEY",
    api: "openai-responses",
    models: payload.models.map((model) => ({
      id: model.key ?? model.key,
      name: model.display_name ?? model.key,
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.max_context_length ?? 128000,
      maxTokens: model.max_context_length
        ? Math.min(16384, Math.floor(model.max_context_length / 4))
        : 16384,
    })),
  });
}
