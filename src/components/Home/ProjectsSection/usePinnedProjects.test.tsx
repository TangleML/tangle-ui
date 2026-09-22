import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFavorites } from "@/hooks/useFavorites";
import { useBackend } from "@/providers/BackendProvider";
import { getProject } from "@/services/projects/projectsService";
import type { Project } from "@/services/projects/types";

import { usePinnedProjects } from "./usePinnedProjects";

vi.mock("@/hooks/useFavorites", () => ({ useFavorites: vi.fn() }));
vi.mock("@/providers/BackendProvider", () => ({ useBackend: vi.fn() }));
vi.mock("@/services/projects/projectsService", () => ({
  getProject: vi.fn(),
}));

function project(id: string): Project {
  return {
    id,
    workspaceId: "ws-1",
    name: `Project ${id}`,
    description: null,
    createdBy: "ada@example.com",
    origin: "user",
    createdAt: new Date("2026-09-21T10:00:00Z"),
    updatedAt: new Date("2026-09-21T10:00:00Z"),
    resourceCounts: {},
    notes: null,
    extraData: null,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function pinned(...items: { type: string; id: string }[]) {
  vi.mocked(useFavorites).mockReturnValue({
    favorites: items.map((item) => ({ ...item, name: item.id })),
  } as unknown as ReturnType<typeof useFavorites>);
}

const asProject = (id: string) => ({ type: "project", id });

async function renderPinned() {
  const view = renderHook(() => usePinnedProjects(), { wrapper });
  await waitFor(() => expect(view.result.current.isPending).toBe(false));
  return view;
}

const idsOf = (projects: { id: string }[]) => projects.map((p) => p.id);

describe("usePinnedProjects", () => {
  beforeEach(() => {
    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: true,
    } as unknown as ReturnType<typeof useBackend>);
    vi.mocked(getProject).mockImplementation((id: string) =>
      Promise.resolve(project(id)),
    );
    pinned();
  });
  afterEach(() => vi.resetAllMocks());

  it("lists the pinned projects in the order they were pinned", async () => {
    pinned(asProject("p-2"), asProject("p-1"));

    const { result } = await renderPinned();

    expect(idsOf(result.current.projects)).toEqual(["p-2", "p-1"]);
  });

  /** Pipelines and runs are pinned into the same store. */
  it("pays no attention to anything else that was starred", async () => {
    pinned({ type: "pipeline", id: "pipe-1" }, asProject("p-1"));

    const { result } = await renderPinned();

    expect(idsOf(result.current.projects)).toEqual(["p-1"]);
  });

  it("drops a project that has since been deleted", async () => {
    vi.mocked(getProject).mockImplementation((id: string) =>
      id === "p-1"
        ? Promise.reject(new Error("Not found"))
        : Promise.resolve(project(id)),
    );
    pinned(asProject("p-1"), asProject("p-2"));

    const { result } = await renderPinned();

    expect(idsOf(result.current.projects)).toEqual(["p-2"]);
  });

  it("asks for nothing while the backend is unavailable", async () => {
    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: false,
    } as unknown as ReturnType<typeof useBackend>);
    pinned(asProject("p-1"));

    const { result } = await renderPinned();

    expect(result.current.projects).toEqual([]);
    expect(getProject).not.toHaveBeenCalled();
  });

  it("is empty when nothing is pinned", async () => {
    const { result } = await renderPinned();

    expect(result.current.projects).toEqual([]);
  });
});
