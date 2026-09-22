import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFavorites } from "@/hooks/useFavorites";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useBackend } from "@/providers/BackendProvider";
import { getProject } from "@/services/projects/projectsService";
import type { Project } from "@/services/projects/types";
import { getUserDetails } from "@/utils/user";

import { useSharedProjects } from "./useSharedProjects";

vi.mock("@/hooks/useFavorites", () => ({ useFavorites: vi.fn() }));
vi.mock("@/hooks/useRecentlyViewed", () => ({ useRecentlyViewed: vi.fn() }));
vi.mock("@/providers/BackendProvider", () => ({ useBackend: vi.fn() }));
vi.mock("@/services/projects/projectsService", () => ({
  getProject: vi.fn(),
}));
vi.mock("@/utils/user", () => ({ getUserDetails: vi.fn() }));

const ME = "ada@example.com";

function project(id: string, createdBy: string | null): Project {
  return {
    id,
    workspaceId: "ws-1",
    name: `Project ${id}`,
    description: null,
    createdBy,
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

function starred(...ids: string[]) {
  vi.mocked(useFavorites).mockReturnValue({
    favorites: ids.map((id) => ({ type: "project" as const, id, name: id })),
  } as unknown as ReturnType<typeof useFavorites>);
}

function visited(...ids: string[]) {
  vi.mocked(useRecentlyViewed).mockReturnValue({
    recentlyViewed: ids.map((id) => ({
      type: "project" as const,
      id,
      name: id,
      timestamp: 1,
    })),
  });
}

async function renderShared() {
  const view = renderHook(() => useSharedProjects(), { wrapper });
  await waitFor(() => expect(view.result.current.isPending).toBe(false));
  return view;
}

const idsOf = (projects: { id: string }[]) => projects.map((p) => p.id);

describe("useSharedProjects", () => {
  beforeEach(() => {
    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: true,
    } as unknown as ReturnType<typeof useBackend>);
    vi.mocked(getUserDetails).mockResolvedValue({
      id: ME,
      permissions: [],
    } as unknown as Awaited<ReturnType<typeof getUserDetails>>);
    vi.mocked(getProject).mockImplementation((id: string) =>
      Promise.resolve(project(id, "bo@example.com")),
    );
    starred();
    visited();
  });
  afterEach(() => vi.resetAllMocks());

  it("lists a project someone else made that this browser has been in", async () => {
    visited("p-1");

    const { result } = await renderShared();

    expect(idsOf(result.current.projects)).toEqual(["p-1"]);
  });

  /** Starring is a decision to keep one; a visit only happened. */
  it("puts the starred ones before the merely visited", async () => {
    starred("p-2");
    visited("p-1", "p-2");

    const { result } = await renderShared();

    expect(idsOf(result.current.projects)).toEqual(["p-2", "p-1"]);
  });

  it("counts a project starred and visited once", async () => {
    starred("p-1");
    visited("p-1");

    const { result } = await renderShared();

    expect(idsOf(result.current.projects)).toEqual(["p-1"]);
  });

  /** They are already under My Projects; listing them twice is just noise. */
  it("leaves out the caller's own projects", async () => {
    vi.mocked(getProject).mockImplementation((id: string) =>
      Promise.resolve(project(id, id === "p-1" ? ME : "bo@example.com")),
    );
    visited("p-1", "p-2");

    const { result } = await renderShared();

    expect(idsOf(result.current.projects)).toEqual(["p-2"]);
  });

  it("drops a project that has since been deleted", async () => {
    vi.mocked(getProject).mockImplementation((id: string) =>
      id === "p-1"
        ? Promise.reject(new Error("Not found"))
        : Promise.resolve(project(id, "bo@example.com")),
    );
    visited("p-1", "p-2");

    const { result } = await renderShared();

    expect(idsOf(result.current.projects)).toEqual(["p-2"]);
  });

  /**
   * An unresolved caller is nobody to be "not the creator" of, and the projects
   * list is showing everyone's projects in that state anyway.
   */
  it("says nothing when there is no resolved user", async () => {
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "Unknown",
      permissions: [],
    } as unknown as Awaited<ReturnType<typeof getUserDetails>>);
    visited("p-1");

    const { result } = await renderShared();

    expect(result.current.projects).toEqual([]);
    expect(getProject).not.toHaveBeenCalled();
  });

  it("asks for nothing while the backend is unavailable", async () => {
    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: false,
    } as unknown as ReturnType<typeof useBackend>);
    visited("p-1");

    const { result } = await renderShared();

    expect(result.current.projects).toEqual([]);
    expect(getProject).not.toHaveBeenCalled();
  });
});
