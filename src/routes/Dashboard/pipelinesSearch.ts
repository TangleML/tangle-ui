import { isRecord } from "@/utils/typeGuards";

interface PipelinesSearch {
  tab?: "local" | "remote";
}

export function validatePipelinesSearch(search: unknown): PipelinesSearch {
  if (!isRecord(search)) return {};
  const { page: _page, ...rest } = search;
  return {
    ...rest,
    tab:
      search.tab === "local" || search.tab === "remote"
        ? search.tab
        : undefined,
  };
}
