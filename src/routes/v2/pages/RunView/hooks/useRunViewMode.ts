import { useLocation, useNavigate, useSearch } from "@tanstack/react-router";

import { isRecord } from "@/utils/typeGuards";

export type RunViewMode = "graph" | "timing";

export function resolveRunViewMode(
  search: unknown,
  timingEnabled: boolean,
): RunViewMode {
  if (!timingEnabled || !isRecord(search)) return "graph";
  return search.view === "timing" ? "timing" : "graph";
}

export function buildRunViewModeSearch(
  search: unknown,
  mode: RunViewMode,
): Record<string, unknown> {
  const nextSearch = isRecord(search) ? { ...search } : {};

  if (mode === "timing") {
    nextSearch.view = "timing";
  } else {
    delete nextSearch.view;
  }

  return nextSearch;
}

export function useRunViewMode(timingEnabled: boolean) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const search: unknown = useSearch({ strict: false });
  const mode = resolveRunViewMode(search, timingEnabled);

  const setMode = (nextMode: RunViewMode) => {
    const nextSearch = buildRunViewModeSearch(search, nextMode);

    // Run routes do not define a single search schema, so preserve their
    // existing search values through this narrow dynamic navigation boundary.
    navigate({
      to: pathname,
      search: nextSearch,
      replace: true,
    } as never);
  };

  return { mode, setMode };
}
