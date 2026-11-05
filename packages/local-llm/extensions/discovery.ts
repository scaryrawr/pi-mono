import type { Static, TSchema } from "typebox";
import { Value } from "typebox/value";

const DISCOVERY_TIMEOUT_MS = 5_000;

/** Fetch and validate a model catalog within one deadline for headers and body. */
export async function fetchModelCatalog<Schema extends TSchema>(
  url: string,
  apiKey: string,
  schema: Schema,
): Promise<Static<Schema> | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      await response.body?.cancel();

      return undefined;
    }

    const payload: unknown = await response.json();

    return Value.Check(schema, payload) ? payload : undefined;
  } catch {
    // Unavailable, slow, and malformed providers must not prevent Pi startup.
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}
