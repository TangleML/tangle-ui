import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRecordTourCompletion, useTourCompletion } from "./tourCompletion";

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

function renderCompletion(tourId: string) {
  return renderHook(
    () => ({
      completed: useTourCompletion(tourId),
      record: useRecordTourCompletion(),
    }),
    { wrapper: makeWrapper() },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchWithErrorHandling.mockResolvedValue({});
  backend = { available: true, backendUrl: "https://backend.example" };
});

describe("tourCompletion (backend)", () => {
  it("reads completion state from the settings endpoint", async () => {
    fetchWithErrorHandling.mockResolvedValueOnce({
      completed_tours: {
        "first-pipeline": {
          completedAt: "2026-06-01T00:00:00.000Z",
          completionCount: 2,
        },
      },
    });

    const { result } = renderCompletion("first-pipeline");

    await waitFor(() => expect(result.current.completed).toBe(true));
  });

  it("records a completion: PATCHes the merged map and flips the cache", async () => {
    const { result } = renderCompletion("first-pipeline");
    await waitFor(() => expect(result.current.completed).toBe(false));

    let recorded!: { completionCount: number; previouslyCompleted: boolean };
    act(() => {
      recorded = result.current.record("first-pipeline");
    });

    expect(recorded.completionCount).toBe(1);
    expect(recorded.previouslyCompleted).toBe(false);
    await waitFor(() => expect(result.current.completed).toBe(true));

    const patchCall = fetchWithErrorHandling.mock.calls.find(
      ([, options]) => options?.method === "PATCH",
    );
    expect(patchCall?.[0]).toBe(
      "https://backend.example/api/users/me/settings",
    );
    const body = JSON.parse(patchCall?.[1]?.body as string);
    expect(
      body.settings.completed_tours["first-pipeline"].completionCount,
    ).toBe(1);
  });

  it("merges with the saved server map when the cache is cold (no clobber)", async () => {
    // The settings endpoint already holds a completion that the local cache
    // has not loaded (e.g. recording before the query resolves).
    fetchWithErrorHandling.mockImplementation((_url, options) => {
      if (options?.method === "PATCH") return Promise.resolve({});
      return Promise.resolve({
        completed_tours: {
          "navigating-editor": {
            completedAt: "2026-06-01T00:00:00.000Z",
            completionCount: 1,
          },
        },
      });
    });

    // Render only the recorder so nothing primes the cache beforehand.
    const { result } = renderHook(() => useRecordTourCompletion(), {
      wrapper: makeWrapper(),
    });

    act(() => {
      result.current("first-pipeline");
    });

    const patchCall = await waitFor(() => {
      const call = fetchWithErrorHandling.mock.calls.find(
        ([, options]) => options?.method === "PATCH",
      );
      expect(call).toBeTruthy();
      return call!;
    });

    const body = JSON.parse(patchCall[1]?.body as string);
    // The previously-saved tour must survive the PATCH...
    expect(body.settings.completed_tours["navigating-editor"]).toBeTruthy();
    // ...alongside the newly recorded one.
    expect(
      body.settings.completed_tours["first-pipeline"].completionCount,
    ).toBe(1);
  });

  it("does not PATCH when no backend is available", async () => {
    backend = { available: false, backendUrl: "" };
    const { result } = renderCompletion("subgraphs");

    act(() => {
      result.current.record("subgraphs");
    });

    expect(
      fetchWithErrorHandling.mock.calls.some(
        ([, options]) => options?.method === "PATCH",
      ),
    ).toBe(false);
    // Still reflected in-session via the cache.
    await waitFor(() => expect(result.current.completed).toBe(true));
  });
});
