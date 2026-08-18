import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  usePrototypeBanners,
  useSavePrototypeBanner,
} from "./prototypeBanners";

const SETTING_NAME = "system:web_ui/banners";

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

function renderBanners() {
  return renderHook(
    () => ({
      query: usePrototypeBanners(),
      save: useSavePrototypeBanner(),
    }),
    { wrapper: makeWrapper() },
  );
}

function patchCalls() {
  return fetchWithErrorHandling.mock.calls.filter(
    ([, options]) => options?.method === "PATCH",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchWithErrorHandling.mockResolvedValue({});
  backend = { available: true, backendUrl: "https://backend.example" };
});

describe("usePrototypeBanners", () => {
  it("asks the settings endpoint for the banners key only", async () => {
    const { result } = renderBanners();

    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    const url = new URL(fetchWithErrorHandling.mock.calls[0][0]);
    expect(url.origin + url.pathname).toBe(
      "https://backend.example/api/users/me/settings",
    );
    expect(url.searchParams.get("setting_names")).toBe(SETTING_NAME);
  });

  it("reads banners newest-first from a top-level payload", async () => {
    fetchWithErrorHandling.mockResolvedValueOnce({
      [SETTING_NAME]: [
        { "2026-01-01T00:00:00.000Z": "old" },
        { "2026-03-01T00:00:00.000Z": "new" },
      ],
    });

    const { result } = renderBanners();

    await waitFor(() =>
      expect(result.current.query.data).toEqual([
        { "2026-03-01T00:00:00.000Z": "new" },
        { "2026-01-01T00:00:00.000Z": "old" },
      ]),
    );
  });

  it("reads banners from a payload wrapped in `settings`", async () => {
    fetchWithErrorHandling.mockResolvedValueOnce({
      settings: { [SETTING_NAME]: [{ "2026-03-01T00:00:00.000Z": "new" }] },
    });

    const { result } = renderBanners();

    await waitFor(() =>
      expect(result.current.query.data).toEqual([
        { "2026-03-01T00:00:00.000Z": "new" },
      ]),
    );
  });

  it("does not call the backend when none is available", async () => {
    backend = { available: false, backendUrl: "" };

    renderBanners();

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchWithErrorHandling).not.toHaveBeenCalled();
  });
});

describe("useSavePrototypeBanner", () => {
  it("PATCHes the whole list with the new banner first", async () => {
    fetchWithErrorHandling.mockResolvedValue({
      [SETTING_NAME]: [{ "2026-01-01T00:00:00.000Z": "old" }],
    });

    const { result } = renderBanners();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));

    act(() => result.current.save.mutate("fresh banner"));
    await waitFor(() => expect(patchCalls()).toHaveLength(1));

    const [url, options] = patchCalls()[0];
    expect(url).toBe("https://backend.example/api/users/me/settings");
    const saved = JSON.parse(options?.body as string).settings[SETTING_NAME];
    expect(Object.values(saved[0])).toEqual(["fresh banner"]);
    expect(saved[1]).toEqual({ "2026-01-01T00:00:00.000Z": "old" });
  });

  it("re-reads the server list before writing, so a concurrent banner survives", async () => {
    // Cache is cold/stale: the server already holds a banner this client
    // never read. A blind write would drop it.
    fetchWithErrorHandling.mockImplementation((_url, options) => {
      if (options?.method === "PATCH") return Promise.resolve({});
      return Promise.resolve({
        [SETTING_NAME]: [{ "2026-02-01T00:00:00.000Z": "saved elsewhere" }],
      });
    });

    const { result } = renderHook(() => useSavePrototypeBanner(), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.mutate("mine"));
    await waitFor(() => expect(patchCalls()).toHaveLength(1));

    const saved = JSON.parse(patchCalls()[0][1]?.body as string).settings[
      SETTING_NAME
    ];
    expect(saved).toHaveLength(2);
    expect(saved[1]).toEqual({ "2026-02-01T00:00:00.000Z": "saved elsewhere" });
  });

  it("keeps history that the endpoint returned as a JSON string", async () => {
    fetchWithErrorHandling.mockImplementation((_url, options) =>
      options?.method === "PATCH"
        ? Promise.resolve({})
        : Promise.resolve({
            [SETTING_NAME]: JSON.stringify([
              { "2026-01-01T00:00:00.000Z": "old" },
            ]),
          }),
    );

    const { result } = renderHook(() => useSavePrototypeBanner(), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.mutate("fresh banner"));
    await waitFor(() => expect(patchCalls()).toHaveLength(1));

    const saved = JSON.parse(patchCalls()[0][1]?.body as string).settings[
      SETTING_NAME
    ];
    expect(saved).toHaveLength(2);
    expect(saved[1]).toEqual({ "2026-01-01T00:00:00.000Z": "old" });
  });

  it("stores an ISO timestamp as the banner key", async () => {
    const { result } = renderHook(() => useSavePrototypeBanner(), {
      wrapper: makeWrapper(),
    });

    act(() => result.current.mutate("timestamped"));
    await waitFor(() => expect(patchCalls()).toHaveLength(1));

    const saved = JSON.parse(patchCalls()[0][1]?.body as string).settings[
      SETTING_NAME
    ];
    expect(Object.keys(saved[0])[0]).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});
