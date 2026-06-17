import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  emptyProgress,
  type OnboardingProgress,
  parseProgress,
  useOnboardingProgress,
  usePersistOnboardingProgress,
} from "./onboardingProgress";

const fetchWithErrorHandling = vi.hoisted(() =>
  vi.fn<(url: string, options?: RequestInit) => Promise<unknown>>(() =>
    Promise.resolve({}),
  ),
);

vi.mock("@/utils/fetchWithErrorHandling", () => ({
  fetchWithErrorHandling: (url: string, options?: RequestInit) =>
    fetchWithErrorHandling(url, options),
}));

let backend = { available: true, backendUrl: "https://backend.example" };

vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function render() {
  return renderHook(
    () => ({
      progress: useOnboardingProgress(),
      persist: usePersistOnboardingProgress(),
    }),
    { wrapper: makeWrapper() },
  );
}

const progressWithDocs: OnboardingProgress = {
  steps: {
    read_docs: true,
    complete_tour: false,
    create_pipeline: false,
    execute_run: false,
  },
  dismissed: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  fetchWithErrorHandling.mockResolvedValue({});
  backend = { available: true, backendUrl: "https://backend.example" };
});

describe("parseProgress", () => {
  it("defaults missing or unknown fields", () => {
    expect(parseProgress(undefined)).toEqual(emptyProgress());
    expect(parseProgress("not json")).toEqual(emptyProgress());
    expect(parseProgress(42)).toEqual(emptyProgress());
  });

  it("coerces step flags to booleans and ignores unknown keys", () => {
    const parsed = parseProgress({
      steps: { read_docs: true, create_pipeline: "yes", bogus: true },
      dismissed: true,
    });
    expect(parsed.steps).toEqual({
      read_docs: true,
      complete_tour: false,
      create_pipeline: false,
      execute_run: false,
    });
    expect(parsed.dismissed).toBe(true);
  });

  it("parses a JSON string payload", () => {
    const parsed = parseProgress(
      JSON.stringify({ steps: { complete_tour: true }, dismissed: false }),
    );
    expect(parsed.steps.complete_tour).toBe(true);
  });
});

describe("onboardingProgress hooks (backend)", () => {
  it("reads progress from the settings endpoint", async () => {
    fetchWithErrorHandling.mockResolvedValueOnce({
      onboarding: { steps: { read_docs: true }, dismissed: false },
    });

    const { result } = render();

    await waitFor(() =>
      expect(result.current.progress.data?.steps.read_docs).toBe(true),
    );
  });

  it("persists by PATCHing the settings endpoint and flips the cache", async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.progress.isSuccess).toBe(true));

    act(() => result.current.persist(progressWithDocs));

    await waitFor(() =>
      expect(result.current.progress.data?.steps.read_docs).toBe(true),
    );

    const patchCall = fetchWithErrorHandling.mock.calls.find(
      ([, options]) => options?.method === "PATCH",
    );
    expect(patchCall?.[0]).toBe(
      "https://backend.example/api/users/me/settings",
    );
    const body = JSON.parse(patchCall?.[1]?.body as string);
    expect(body.settings.onboarding.steps.read_docs).toBe(true);
    expect(patchCall?.[1]?.keepalive).toBe(true);
  });
});

describe("onboardingProgress hooks (offline)", () => {
  it("neither fetches nor persists when no backend is available", async () => {
    backend = { available: false, backendUrl: "" };
    const { result } = render();

    expect(result.current.progress.fetchStatus).toBe("idle");

    act(() => result.current.persist(progressWithDocs));

    expect(fetchWithErrorHandling).not.toHaveBeenCalled();
  });
});
