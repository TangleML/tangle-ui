import { DEFAULT_TANGENT_BASE_URL } from "@/routes/v2/pages/Tangent/constants";
import { isRecord } from "@/utils/typeGuards";

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function resolveTangentBaseUrl(
  metadata: Record<string, unknown> | null | undefined,
): string {
  if (!isRecord(metadata)) return DEFAULT_TANGENT_BASE_URL;
  const { tangentBaseUrl } = metadata;
  if (typeof tangentBaseUrl !== "string") return DEFAULT_TANGENT_BASE_URL;
  const normalized = normalizeBaseUrl(tangentBaseUrl);
  return normalized.length > 0 ? normalized : DEFAULT_TANGENT_BASE_URL;
}
