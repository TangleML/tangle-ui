import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./projectsService");

let backend = { configured: true, available: true };
vi.mock("@/providers/BackendProvider", () => ({
  useBackend: () => backend,
}));

import * as projectsService from "./projectsService";
import type { ProjectSummary } from "./types";
import { useAllProjects } from "./useAllProjects";

function makeProject(id: string): ProjectSummary {
  return {
    id,
    workspaceId: "w1",
    name: `Project ${id}`,
    description: null,
    createdBy: null,
    origin: "user",
    createdAt: new Date("2026-01-02T03:04:05Z"),
    updatedAt: new Date("2026-02-03T04:05:06Z"),
    resourceCounts: {},
  };
}

function page(ids: string[], nextPageToken: string | null, totalCount: number) {
  return { items: ids.map(makeProject), nextPageToken, totalCount };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={makeClient()}>{children}</QueryClientProvider>
  );
}

describe("useAllProjects", () => {
  beforeEach(() => {
    backend = { configured: true, available: true };
    vi.resetAllMocks();
  });

  it("asks for one page when that is all there is", async () => {
    vi.mocked(projectsService.listProjects).mockResolvedValue(
      page(["a", "b"], null, 2),
    );

    const { result } = renderHook(() => useAllProjects(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.items.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result.current.data?.totalCount).toBe(2);
    expect(result.current.data?.reachedPageLimit).toBe(false);
    expect(projectsService.listProjects).toHaveBeenCalledTimes(1);
  });

  it("follows the page tokens until the backend runs out", async () => {
    vi.mocked(projectsService.listProjects)
      .mockResolvedValueOnce(page(["a"], "token-2", 3))
      .mockResolvedValueOnce(page(["b"], "token-3", 3))
      .mockResolvedValueOnce(page(["c"], null, 3));

    const { result } = renderHook(() => useAllProjects(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.items.map((p) => p.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(result.current.data?.reachedPageLimit).toBe(false);
  });

  it("carries each page's token into the next request", async () => {
    vi.mocked(projectsService.listProjects)
      .mockResolvedValueOnce(page(["a"], "token-2", 2))
      .mockResolvedValueOnce(page(["b"], null, 2));

    const { result } = renderHook(() => useAllProjects(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(projectsService.listProjects).toHaveBeenNthCalledWith(1, {
      pageSize: 100,
      pageToken: undefined,
    });
    expect(projectsService.listProjects).toHaveBeenNthCalledWith(2, {
      pageSize: 100,
      pageToken: "token-2",
    });
  });

  it("stops at its ceiling and says it did", async () => {
    vi.mocked(projectsService.listProjects).mockResolvedValue(
      page(["a"], "always-more", 900),
    );

    const { result } = renderHook(() => useAllProjects(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.reachedPageLimit).toBe(true);
    expect(result.current.data?.totalCount).toBe(900);
    expect(projectsService.listProjects).toHaveBeenCalledTimes(5);
  });

  it("asks for nothing at all without a backend", () => {
    backend = { configured: false, available: false };

    const { result } = renderHook(() => useAllProjects(), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(projectsService.listProjects).not.toHaveBeenCalled();
  });

  it("surfaces a failure part-way through the pages", async () => {
    vi.mocked(projectsService.listProjects)
      .mockResolvedValueOnce(page(["a"], "token-2", 2))
      .mockRejectedValueOnce(new Error("page two exploded"));

    const { result } = renderHook(() => useAllProjects(), { wrapper });

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error?.message).toBe("page two exploded");
  });
});
