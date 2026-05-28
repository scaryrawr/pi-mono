import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const OSARAUS_BASE_URL = process.env.OSARAUS_BASE_URL ?? "http://localhost:1337";
const OSARAUS_API_KEY = process.env.OSARAUS_API_KEY ?? "osaurus";

const OSARAUS_CONTEXT_LENGTH = parseContextLength(process.env.OSARAUS_CONTEXT_LENGTH) ?? 131_072;
const OSARAUS_MAX_TOKENS = Math.min(32_768, Math.floor(OSARAUS_CONTEXT_LENGTH / 4));

function parseContextLength(value: string | undefined) {
  if (value === undefined) return undefined;

  const contextLength = Number.parseInt(value, 10);
  if (!Number.isFinite(contextLength) || contextLength <= 0) {
    return undefined;
  }

  return contextLength;
}

async function fetchOsaurusModels() {
  try {
    const response = await fetch(`${OSARAUS_BASE_URL}/api/tags`, {
      headers: { Authorization: `Bearer ${OSARAUS_API_KEY}` },
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
  const payload = await fetchOsaurusModels();
  if (payload === undefined) return;

  pi.registerProvider("osaurus", {
    baseUrl: `${OSARAUS_BASE_URL}/v1`,
    apiKey: OSARAUS_API_KEY,
    api: "openai-completions",
    models: payload.models.map((model) => ({
      id: model.name,
      name: model.model ?? model.name,
      reasoning: false,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: OSARAUS_CONTEXT_LENGTH,
      maxTokens: OSARAUS_MAX_TOKENS,
    })),
  });
}
