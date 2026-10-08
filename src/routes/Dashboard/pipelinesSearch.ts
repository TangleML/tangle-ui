import { isRecord } from "@/utils/typeGuards";

interface PipelinesSearch {
  tab?: "local" | "remote";
  page?: number;
}

export function validatePipelinesSearch(search: unknown): PipelinesSearch {
  if (!isRecord(search)) return {};
  const rawPage = search.page;
  const page =
    typeof rawPage === "number" || typeof rawPage === "string"
      ? Number(rawPage)
      : NaN;
  return {
    ...search,
    tab:
      search.tab === "local" || search.tab === "remote"
        ? search.tab
        : undefined,
    page: Number.isSafeInteger(page) && page > 0 ? page : undefined,
  };
}
