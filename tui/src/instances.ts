import { array, object, optional, safeParse, string } from "zod/mini";

export interface InstancePreset {
  label: string;
  apiUrl: string;
  uiUrl?: string;
}

const presetsSchema = array(
  object({
    label: string(),
    apiUrl: string(),
    uiUrl: optional(string()),
  }),
);

/**
 * The well-known Tangle instances offered on the connect screen, read from the
 * `TANGLE_INSTANCE_PRESETS` JSON array in the environment (populated from `.env`
 * by the `loadEnv` side-effect import in `main.tsx`). Unset or malformed input
 * yields an empty list, leaving only the custom-URL entry.
 */
export function parseInstancePresets(
  raw: string | undefined,
): InstancePreset[] {
  if (!raw) return [];
  const parsed = safeParse(presetsSchema, safeJsonParse(raw));
  return parsed.success ? parsed.data : [];
}

export const INSTANCE_PRESETS = parseInstancePresets(
  process.env.TANGLE_INSTANCE_PRESETS,
);

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function normalizeInstanceUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Use an http:// or https:// URL.");
  }
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}
