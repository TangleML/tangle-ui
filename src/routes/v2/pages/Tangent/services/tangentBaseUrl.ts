import { DEV_TANGENT_BASE_URL } from "@/routes/v2/pages/Tangent/constants";
import { isRecord } from "@/utils/typeGuards";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function fallbackBaseUrl(): string | null {
  return import.meta.env.DEV ? DEV_TANGENT_BASE_URL : null;
}

export function resolveTangentBaseUrl(
  metadata: Record<string, unknown> | null | undefined,
): string | null {
  if (!isRecord(metadata)) return fallbackBaseUrl();
  const { tangentBaseUrl } = metadata;
  if (typeof tangentBaseUrl !== "string") return fallbackBaseUrl();
  const normalized = normalizeBaseUrl(tangentBaseUrl);
  return normalized.length > 0 ? normalized : fallbackBaseUrl();
}
