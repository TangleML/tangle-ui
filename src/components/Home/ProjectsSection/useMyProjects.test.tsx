import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBackend } from "@/providers/BackendProvider";
import { listProjects } from "@/services/projects/projectsService";
import type { ProjectPage, ProjectSummary } from "@/services/projects/types";
import { getUserDetails } from "@/utils/user";

import { useMyProjects } from "./useMyProjects";

vi.mock("@/providers/BackendProvider", () => ({ useBackend: vi.fn() }));

vi.mock("@/services/projects/projectsService", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/utils/user", () => ({ getUserDetails: vi.fn() }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const project = (id: string) => ({ id, name: id }) as ProjectSummary;

const page = (
  items: ProjectSummary[],
  nextPageToken: string | null,
): ProjectPage => ({ items, nextPageToken, totalCount: 5 });

const render = () => renderHook(() => useMyProjects(), { wrapper });

describe("useMyProjects", () => {
  beforeEach(() => {
    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: true,
    } as unknown as ReturnType<typeof useBackend>);
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "someone@example.com",
      permissions: [],
    });
    vi.mocked(listProjects).mockResolvedValue(page([project("a")], null));
  });
  afterEach(() => vi.resetAllMocks());

  it("asks the backend only for the current user's projects", async () => {
    render();

    await waitFor(() =>
      expect(listProjects).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: "someone@example.com" }),
      ),
    );
  });

  it("lists every project when the user cannot be identified", async () => {
    vi.mocked(getUserDetails).mockResolvedValue({
      id: "Unknown",
      permissions: [],
    });

    render();

    await waitFor(() =>
      expect(listProjects).toHaveBeenCalledWith(
        expect.objectContaining({ createdBy: undefined }),
      ),
    );
  });

  /**
   * The list is cached under the params it was asked with, so asking before the
   * user lands would fetch everyone's projects and then the user's, leaving two
   * answers to one question.
   */
  it("waits for the user before asking at all", () => {
    render();

    expect(listProjects).not.toHaveBeenCalled();
  });

  it("reads as pending until the user lands", async () => {
    const { result } = render();

    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });

  it("offers no more to load when the backend sent the lot", async () => {
    const { result } = render();

    await waitFor(() => expect(result.current.projects).toHaveLength(1));
    expect(result.current.hasMore).toBe(false);
  });

  it("appends the next page to the ones already shown", async () => {
    vi.mocked(listProjects).mockResolvedValueOnce(
      page([project("a"), project("b")], "token-2"),
    );
    vi.mocked(listProjects).mockResolvedValueOnce(page([project("c")], null));

    const { result } = render();

    await waitFor(() => expect(result.current.hasMore).toBe(true));
    act(() => result.current.loadMore());

    await waitFor(() =>
      expect(result.current.projects.map((p) => p.id)).toEqual(["a", "b", "c"]),
    );
    expect(vi.mocked(listProjects).mock.calls[1][0]).toMatchObject({
      pageToken: "token-2",
    });
    expect(result.current.hasMore).toBe(false);
  });

  it("says how many there are in total, not just how many are shown", async () => {
    vi.mocked(listProjects).mockResolvedValue(
      page([project("a"), project("b")], "token-2"),
    );

    const { result } = render();

    await waitFor(() => expect(result.current.totalCount).toBe(5));
    expect(result.current.projects).toHaveLength(2);
  });

  it("does not ask an unreachable backend", () => {
    vi.mocked(useBackend).mockReturnValue({
      configured: true,
      available: false,
    } as unknown as ReturnType<typeof useBackend>);

    render();

    expect(listProjects).not.toHaveBeenCalled();
  });
});
