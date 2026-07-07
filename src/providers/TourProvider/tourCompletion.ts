import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { USER_SETTINGS_PATH } from "@/utils/constants";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

interface TourCompletionRecord {
  completedAt: string;
  completionCount: number;
}

type TourCompletionMap = Record<string, TourCompletionRecord>;

const COMPLETED_TOURS_KEY = "completed_tours";
const QUERY_KEY = "tourCompletions";
const STALE_MS = 1000 * 60 * 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCompletionMap(value: unknown): TourCompletionMap {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!isRecord(raw)) return {};

  const out: TourCompletionMap = {};
  for (const [tourId, record] of Object.entries(raw)) {
    if (
      isRecord(record) &&
      typeof record.completedAt === "string" &&
      typeof record.completionCount === "number"
    ) {
      out[tourId] = {
        completedAt: record.completedAt,
        completionCount: record.completionCount,
      };
    }
  }
  return out;
}

function extractCompletedTours(payload: unknown): TourCompletionMap {
  if (!isRecord(payload)) return {};
  const wrapped = isRecord(payload.settings)
    ? payload.settings[COMPLETED_TOURS_KEY]
    : undefined;
  return parseCompletionMap(payload[COMPLETED_TOURS_KEY] ?? wrapped);
}

async function fetchCompletions(
  backendUrl: string,
): Promise<TourCompletionMap> {
  const url = new URL(USER_SETTINGS_PATH, backendUrl);
  url.searchParams.set("setting_names", COMPLETED_TOURS_KEY);
  const payload = await fetchWithErrorHandling(url.toString());
  return extractCompletedTours(payload);
}

function queryKey(backendUrl: string) {
  return [QUERY_KEY, backendUrl] as const;
}

export function useTourCompletions() {
  const { available, backendUrl } = useBackend();
  return useQuery({
    queryKey: queryKey(backendUrl),
    queryFn: () => fetchCompletions(backendUrl),
    enabled: available && Boolean(backendUrl),
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function useTourCompletion(tourId: string): boolean {
  const { data } = useTourCompletions();
  return Boolean(data?.[tourId]);
}

interface RecordedCompletion {
  completionCount: number;
  previouslyCompleted: boolean;
}

export function useRecordTourCompletion() {
  const queryClient = useQueryClient();
  const { available, backendUrl } = useBackend();

  const { mutate } = useMutation({
    mutationFn: async (tourId: string) => {
      const key = queryKey(backendUrl);
      // Merge against the authoritative server map — fetching it when the query
      // hasn't loaded yet or previously failed — so the PATCH can never replace
      // saved completions with only the current tour.
      const current = await queryClient.ensureQueryData({
        queryKey: key,
        queryFn: () => fetchCompletions(backendUrl),
      });
      const next: TourCompletionMap = {
        ...current,
        [tourId]: {
          completedAt: new Date().toISOString(),
          completionCount: (current[tourId]?.completionCount ?? 0) + 1,
        },
      };

      const url = new URL(USER_SETTINGS_PATH, backendUrl);
      await fetchWithErrorHandling(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [COMPLETED_TOURS_KEY]: next } }),
      });
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey(backendUrl), next);
    },
    onError: () => {
      // Our optimistic value may be wrong; re-sync from the server.
      void queryClient.invalidateQueries({ queryKey: queryKey(backendUrl) });
    },
  });

  return (tourId: string): RecordedCompletion => {
    const key = queryKey(backendUrl);
    const current = queryClient.getQueryData<TourCompletionMap>(key) ?? {};
    const previouslyCompleted = Boolean(current[tourId]);
    const completionCount = (current[tourId]?.completionCount ?? 0) + 1;

    if (available && backendUrl) {
      mutate(tourId);
    } else {
      // No backend: nothing to clobber, so keep the optimistic local cache
      // update so the completion is reflected for the rest of the session.
      queryClient.setQueryData<TourCompletionMap>(key, {
        ...current,
        [tourId]: { completedAt: new Date().toISOString(), completionCount },
      });
    }

    return { completionCount, previouslyCompleted };
  };
}
