import { addDays, isValid, parseISO } from "date-fns";

import { remotePipelineFiltersToQuery } from "@/services/remotePipelinesService";
import { isRecord } from "@/utils/typeGuards";

export interface RemotePipelineSearchFilters {
  name?: string;
  id?: string;
  user?: string;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

interface PipelinesSearch extends RemotePipelineSearchFilters {
  tab?: "local" | "remote";
  page?: number;
}

function dateParam(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !value.startsWith("0000-") &&
    isValid(parseISO(value))
    ? value
    : undefined;
}

export function validatePipelinesSearch(search: unknown): PipelinesSearch {
  if (!isRecord(search)) return {};
  const rawPage = search.page;
  const page =
    typeof rawPage === "number" || typeof rawPage === "string"
      ? Number(rawPage)
      : NaN;
  const createdFrom = dateParam(search.createdFrom);
  const createdTo = dateParam(search.createdTo);
  const updatedFrom = dateParam(search.updatedFrom);
  const updatedTo = dateParam(search.updatedTo);
  return {
    ...search,
    tab:
      search.tab === "local" || search.tab === "remote"
        ? search.tab
        : undefined,
    page: Number.isSafeInteger(page) && page > 0 ? page : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    id: typeof search.id === "string" ? search.id : undefined,
    user: typeof search.user === "string" ? search.user : undefined,
    createdFrom,
    createdTo:
      createdFrom && createdTo && createdTo >= createdFrom
        ? createdTo
        : undefined,
    updatedFrom,
    updatedTo:
      updatedFrom && updatedTo && updatedTo >= updatedFrom
        ? updatedTo
        : undefined,
  };
}

export function isInvalidPipelineId(id: string | undefined): boolean {
  return Boolean(
    id?.trim() &&
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      id.trim(),
    ),
  );
}

export function getRemotePipelinesFilterQuery(
  filters: RemotePipelineSearchFilters,
) {
  return remotePipelineFiltersToQuery({
    name: filters.name?.trim(),
    id: filters.id?.trim(),
    user: filters.user?.trim(),
    createdAfter:
      filters.createdFrom && parseISO(filters.createdFrom).toISOString(),
    createdBefore:
      filters.createdTo &&
      addDays(parseISO(filters.createdTo), 1).toISOString(),
    updatedAfter:
      filters.updatedFrom && parseISO(filters.updatedFrom).toISOString(),
    updatedBefore:
      filters.updatedTo &&
      addDays(parseISO(filters.updatedTo), 1).toISOString(),
  });
}
