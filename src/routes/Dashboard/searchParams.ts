import { isRecord } from "@/utils/typeGuards";

export interface DashboardComponentsV2SearchParams {
  component?: string;
  q?: string;
  disabled_sources?: string;
}

const VALID_SOURCE_KEYS = new Set([
  "standard",
  "published",
  "registered",
  "user",
]);

/**
 * Read the `?component=<digest>` search param from a TanStack Router search
 * object. Shared between the V1 and V2 dashboard views so both surfaces parse
 * the same param the same way.
 */
export function readSelectedComponentDigest(
  search: unknown,
): string | undefined {
  if (!isRecord(search)) return undefined;
  return typeof search.component === "string" ? search.component : undefined;
}

export function readComponentSearchQuery(search: unknown): string {
  if (!isRecord(search)) return "";
  return typeof search.q === "string" ? search.q : "";
}

export function readDisabledSourceKeys(search: unknown): string[] {
  if (!isRecord(search) || typeof search.disabled_sources !== "string") {
    return [];
  }

  return search.disabled_sources
    .split(",")
    .filter((key) => VALID_SOURCE_KEYS.has(key));
}

export function createDashboardComponentsV2SearchParams({
  component,
  q,
  disabledSourceKeys,
}: {
  component?: string;
  q: string;
  disabledSourceKeys: string[];
}): DashboardComponentsV2SearchParams {
  const hasNonWhitespaceQuery = q.trim().length > 0;
  const validDisabledKeys = disabledSourceKeys.filter((key) =>
    VALID_SOURCE_KEYS.has(key),
  );

  return {
    ...(component ? { component } : {}),
    ...(hasNonWhitespaceQuery ? { q } : {}),
    ...(validDisabledKeys.length > 0
      ? { disabled_sources: validDisabledKeys.join(",") }
      : {}),
  };
}
