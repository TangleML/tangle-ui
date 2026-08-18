import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import {
  PROTOTYPE_BANNERS_SETTING_NAME,
  USER_SETTINGS_PATH,
} from "@/utils/constants";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

/**
 * One banner is a single-entry map of ISO timestamp to banner text:
 * `{ "2026-05-01T12:00:00.000Z": "Runs are delayed" }`.
 *
 * The stored setting is a list of those, newest first, so the whole banner
 * history lives in one JSON value under the
 * `PROTOTYPE_BANNERS_SETTING_NAME` key.
 */
export type PrototypeBanner = Record<string, string>;

const QUERY_KEY = "prototypeBanners";

export function bannerTimestamp(banner: PrototypeBanner): string {
  return Object.keys(banner)[0] ?? "";
}

export function bannerText(banner: PrototypeBanner): string {
  return Object.values(banner)[0] ?? "";
}

function sortNewestFirst(banners: PrototypeBanner[]): PrototypeBanner[] {
  return [...banners].sort((a, b) =>
    bannerTimestamp(b).localeCompare(bannerTimestamp(a)),
  );
}

/**
 * Keeps only single-entry string maps, sorted newest first.
 *
 * The settings endpoint can hand a value back as a JSON string, so a string
 * is parsed before validation — same as the tour and onboarding readers.
 * Treating a stringified list as "no banners" would make the save path
 * overwrite the whole history with one entry.
 */
export function parseBanners(value: unknown): PrototypeBanner[] {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];

  const banners: PrototypeBanner[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      continue;
    }
    const pairs = Object.entries(entry as Record<string, unknown>);
    if (pairs.length !== 1) continue;
    const [timestamp, text] = pairs[0];
    if (!timestamp || typeof text !== "string") continue;
    banners.push({ [timestamp]: text });
  }
  return sortNewestFirst(banners);
}

export function withNewBanner(
  banners: PrototypeBanner[],
  text: string,
  now: Date = new Date(),
): PrototypeBanner[] {
  return sortNewestFirst([{ [now.toISOString()]: text }, ...banners]);
}

export function latestBanner(
  banners: PrototypeBanner[],
): PrototypeBanner | undefined {
  return banners[0];
}

function extractBanners(payload: unknown): PrototypeBanner[] {
  if (typeof payload !== "object" || payload === null) return [];
  const record = payload as Record<string, unknown>;
  const settings = record.settings as Record<string, unknown> | undefined;
  return parseBanners(
    record[PROTOTYPE_BANNERS_SETTING_NAME] ??
      settings?.[PROTOTYPE_BANNERS_SETTING_NAME],
  );
}

async function fetchBanners(backendUrl: string): Promise<PrototypeBanner[]> {
  const url = new URL(USER_SETTINGS_PATH, backendUrl);
  url.searchParams.set("setting_names", PROTOTYPE_BANNERS_SETTING_NAME);
  return extractBanners(await fetchWithErrorHandling(url.toString()));
}

function queryKey(backendUrl: string) {
  return [QUERY_KEY, backendUrl] as const;
}

export function usePrototypeBanners() {
  const { available, backendUrl } = useBackend();

  return useQuery({
    queryKey: queryKey(backendUrl),
    queryFn: () => fetchBanners(backendUrl),
    enabled: available && Boolean(backendUrl),
    refetchOnWindowFocus: false,
  });
}

/**
 * Appends a banner. The settings API merges top-level keys only, so the list
 * is read, extended and written back as a whole value.
 */
export function useSavePrototypeBanner() {
  const queryClient = useQueryClient();
  const { backendUrl } = useBackend();

  return useMutation({
    mutationFn: async (text: string) => {
      const next = withNewBanner(await fetchBanners(backendUrl), text);
      const url = new URL(USER_SETTINGS_PATH, backendUrl);
      await fetchWithErrorHandling(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { [PROTOTYPE_BANNERS_SETTING_NAME]: next },
        }),
      });
      return next;
    },
    onSuccess: (next) => {
      queryClient.setQueryData(queryKey(backendUrl), next);
    },
  });
}
