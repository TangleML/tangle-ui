import { isRecord } from "@/utils/typeGuards";

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
