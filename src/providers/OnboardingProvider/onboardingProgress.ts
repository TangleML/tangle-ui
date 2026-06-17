import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBackend } from "@/providers/BackendProvider";
import { USER_SETTINGS_PATH } from "@/utils/constants";
import { fetchWithErrorHandling } from "@/utils/fetchWithErrorHandling";

import { ONBOARDING_STEP_IDS, type OnboardingStepId } from "./steps";

export type OnboardingSteps = Record<OnboardingStepId, boolean>;

export interface OnboardingProgress {
  steps: OnboardingSteps;
  dismissed: boolean;
}

const ONBOARDING_KEY = "onboarding";
const QUERY_KEY = "onboardingProgress";
const STALE_MS = 1000 * 60 * 5;

function emptySteps(): OnboardingSteps {
  return Object.fromEntries(
    ONBOARDING_STEP_IDS.map((id) => [id, false]),
  ) as OnboardingSteps;
}

export function emptyProgress(): OnboardingProgress {
  return { steps: emptySteps(), dismissed: false };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseProgress(value: unknown): OnboardingProgress {
  let raw = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return emptyProgress();
    }
  }
  if (!isRecord(raw)) return emptyProgress();

  const rawSteps = isRecord(raw.steps) ? raw.steps : {};
  const steps = emptySteps();
  for (const id of ONBOARDING_STEP_IDS) {
    steps[id] = rawSteps[id] === true;
  }

  return {
    steps,
    dismissed: raw.dismissed === true,
  };
}

function extractProgress(payload: unknown): OnboardingProgress {
  if (!isRecord(payload)) return emptyProgress();
  const wrapped = isRecord(payload.settings)
    ? payload.settings[ONBOARDING_KEY]
    : undefined;
  return parseProgress(payload[ONBOARDING_KEY] ?? wrapped);
}

async function fetchProgress(backendUrl: string): Promise<OnboardingProgress> {
  const url = new URL(USER_SETTINGS_PATH, backendUrl);
  url.searchParams.set("setting_names", ONBOARDING_KEY);
  const payload = await fetchWithErrorHandling(url.toString());
  return extractProgress(payload);
}

function queryKey(backendUrl: string) {
  return [QUERY_KEY, backendUrl] as const;
}

export function useOnboardingProgress() {
  const { available, backendUrl } = useBackend();
  const hasBackend = available && Boolean(backendUrl);

  return useQuery({
    queryKey: queryKey(backendUrl),
    queryFn: () => fetchProgress(backendUrl),
    enabled: hasBackend,
    staleTime: STALE_MS,
    refetchOnWindowFocus: false,
  });
}

export function usePersistOnboardingProgress() {
  const queryClient = useQueryClient();
  const { available, backendUrl } = useBackend();
  const hasBackend = available && Boolean(backendUrl);

  const { mutate } = useMutation({
    mutationFn: async (next: OnboardingProgress) => {
      const url = new URL(USER_SETTINGS_PATH, backendUrl);
      await fetchWithErrorHandling(url.toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [ONBOARDING_KEY]: next } }),
        // Often fired just before a navigation/reload; survive page unload.
        keepalive: true,
      });
    },
  });

  return (next: OnboardingProgress) => {
    if (!hasBackend) return;
    queryClient.setQueryData(queryKey(backendUrl), next);
    mutate(next);
  };
}
