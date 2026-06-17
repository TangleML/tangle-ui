import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitUserPipelineWritten } from "@/utils/userPipelineWriteEvents";

import { OnboardingProvider, useOnboarding } from "./OnboardingProvider";

const fetchWithErrorHandling = vi.hoisted(() =>
  vi.fn<(url: string, options?: RequestInit) => Promise<unknown>>(),
);
const track = vi.hoisted(() => vi.fn());

vi.mock("@/utils/fetchWithErrorHandling", () => ({
  fetchWithErrorHandling: (url: string, options?: RequestInit) =>
    fetchWithErrorHandling(url, options),
}));

let backend = { available: true, backendUrl: "https://backend.example" };
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

vi.mock("@/providers/AnalyticsProvider", () => ({
  useAnalytics: () => ({ track }),
}));

let tourCompletions: Record<string, unknown> | undefined = {};
vi.mock("@/providers/TourProvider/tourCompletion", () => ({
  useTourCompletions: () => ({ data: tourCompletions }),
}));

let settingsPayload: unknown = {};
let runsPayload: unknown = { pipeline_runs: [] };

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <OnboardingProvider>{children}</OnboardingProvider>
    </QueryClientProvider>
  );
}

function render() {
  return renderHook(() => useOnboarding(), { wrapper });
}

function completedSteps(result: { current: ReturnType<typeof useOnboarding> }) {
  return result.current.steps
    .filter((step) => step.completed)
    .map((step) => step.id);
}

function lastPatchBody() {
  const patch = fetchWithErrorHandling.mock.calls.find(
    ([, options]) => options?.method === "PATCH",
  );
  return JSON.parse(patch?.[1]?.body as string);
}

function patched() {
  return fetchWithErrorHandling.mock.calls.some(
    ([, options]) => options?.method === "PATCH",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  backend = { available: true, backendUrl: "https://backend.example" };
  tourCompletions = {};
  settingsPayload = {};
  runsPayload = { pipeline_runs: [] };

  fetchWithErrorHandling.mockImplementation((url, options) => {
    if (options?.method === "PATCH") return Promise.resolve({});
    if (url.includes("/api/users/me/settings"))
      return Promise.resolve(settingsPayload);
    if (url.includes("/api/pipeline_runs/"))
      return Promise.resolve(runsPayload);
    return Promise.resolve({});
  });
});

describe("OnboardingProvider", () => {
  it("reports no progress for a brand-new user and does not persist", async () => {
    const { result } = render();

    await waitFor(() => expect(result.current.total).toBe(4));
    expect(result.current.completedCount).toBe(0);
    expect(result.current.isComplete).toBe(false);
    expect(patched()).toBe(false);
  });

  it("derives tour and run completion live without persisting them", async () => {
    tourCompletions = { "first-pipeline": { completedAt: "x" } };
    runsPayload = { pipeline_runs: [{ id: "run-1" }] };

    const { result } = render();

    await waitFor(() =>
      expect(completedSteps(result).sort()).toEqual([
        "complete_tour",
        "execute_run",
      ]),
    );
    expect(patched()).toBe(false);
  });

  it("persists create_pipeline when the user writes a pipeline", async () => {
    const { result } = render();

    act(() => emitUserPipelineWritten());

    await waitFor(() =>
      expect(completedSteps(result)).toContain("create_pipeline"),
    );
    expect(lastPatchBody().settings.onboarding.steps.create_pipeline).toBe(
      true,
    );
    expect(track).toHaveBeenCalledWith("onboarding.step.completed", {
      step_id: "create_pipeline",
    });
  });

  it("marks the docs step read on demand", async () => {
    settingsPayload = { onboarding: { steps: { create_pipeline: true } } };
    const { result } = render();
    await waitFor(() =>
      expect(completedSteps(result)).toContain("create_pipeline"),
    );

    act(() => result.current.markDocsRead());

    await waitFor(() => expect(completedSteps(result)).toContain("read_docs"));
    expect(lastPatchBody().settings.onboarding.steps.read_docs).toBe(true);
    expect(track).toHaveBeenCalledWith("onboarding.step.completed", {
      step_id: "read_docs",
    });
  });

  it("dismisses and restores onboarding", async () => {
    settingsPayload = { onboarding: { steps: { create_pipeline: true } } };
    const { result } = render();
    await waitFor(() =>
      expect(completedSteps(result)).toContain("create_pipeline"),
    );
    expect(result.current.dismissed).toBe(false);

    act(() => result.current.dismiss());
    await waitFor(() => expect(result.current.dismissed).toBe(true));
    expect(lastPatchBody().settings.onboarding.dismissed).toBe(true);
    expect(track).toHaveBeenCalledWith("onboarding.dismissed");

    act(() => result.current.reopen());
    await waitFor(() => expect(result.current.dismissed).toBe(false));
    expect(track).toHaveBeenCalledWith("onboarding.reopened");
  });

  it("is complete once persisted and derived steps are all satisfied", async () => {
    settingsPayload = {
      onboarding: { steps: { read_docs: true, create_pipeline: true } },
    };
    tourCompletions = { "first-pipeline": { completedAt: "x" } };
    runsPayload = { pipeline_runs: [{ id: "run-1" }] };

    const { result } = render();

    await waitFor(() => expect(result.current.isComplete).toBe(true));
    expect(result.current.completedCount).toBe(4);
  });
});
