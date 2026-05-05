import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const OMLX_BASE_URL = process.env.OMLX_BASE_URL ?? "http://localhost:8000";
const OMLX_API_KEY = process.env.OMLX_API_KEY ?? "omlx";

async function fetchOMLXModels() {
  try {
    const response = await fetch(`${OMLX_BASE_URL}/v1/models/status`, {
      headers: {
        Authorization: `Bearer ${OMLX_API_KEY}`,
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
        engine_type: "vlm" | "llm" | (string & {});
      }>;
    };
  } catch {
    return undefined;
  }
}

export default async function (pi: ExtensionAPI) {
  const payload = await fetchOMLXModels();
  if (payload === undefined) return;

  pi.registerProvider("omlx", {
    baseUrl: `${OMLX_BASE_URL}/v1`,
    apiKey: OMLX_API_KEY,
    api: "openai-completions",
    models: payload.models.map((model) => {
      return {
        id: model.id,
        name: model.id,
        reasoning: true,
        input: model.engine_type === "vlm" ? ["text", "image"] : ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: model.max_context_window,
        maxTokens: model.max_tokens,
      };
    }),
  });
}
