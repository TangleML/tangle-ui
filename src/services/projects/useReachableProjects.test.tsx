import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectSummary } from "./types";
import { usePinnedProjects } from "./usePinnedProjects";
import { useProjectAuthor } from "./useProjectAuthor";
import { useProjects } from "./useProjects";
import { useReachableProjects } from "./useReachableProjects";

vi.mock("./usePinnedProjects", () => ({ usePinnedProjects: vi.fn() }));
vi.mock("./useProjectAuthor", () => ({ useProjectAuthor: vi.fn() }));
vi.mock("./useProjects", () => ({ useProjects: vi.fn() }));

const project = (id: string) => ({ id, name: id }) as ProjectSummary;

function given({
  createdBy = "ada@example.com" as string | undefined,
  authorError = null as Error | null,
  mine = [] as ProjectSummary[],
  pinned = [] as ProjectSummary[],
} = {}) {
  vi.mocked(useProjectAuthor).mockReturnValue({
    createdBy,
    isPending: false,
    error: authorError,
  });
  vi.mocked(useProjects).mockReturnValue({
    data: { items: mine },
    isPending: false,
    error: null,
  } as unknown as ReturnType<typeof useProjects>);
  vi.mocked(usePinnedProjects).mockReturnValue({
    projects: pinned,
    isPending: false,
  });
}

const idsOf = () =>
  renderHook(() => useReachableProjects()).result.current.projects.map(
    (one) => one.id,
  );

describe("useReachableProjects", () => {
  beforeEach(() => vi.clearAllMocks());

  it("asks only for the caller's own projects", () => {
    given({ mine: [project("a")] });

    renderHook(() => useReachableProjects());

    expect(useProjects).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "ada@example.com" }),
      expect.anything(),
    );
  });

  /** A shared project is gone with the link unless it was pinned. */
  it("includes a pinned project the caller did not create", () => {
    given({ mine: [project("a")], pinned: [project("shared")] });

    expect(idsOf()).toEqual(["shared", "a"]);
  });

  it("lists a pinned project of the caller's own once", () => {
    given({ mine: [project("a"), project("b")], pinned: [project("a")] });

    expect(idsOf()).toEqual(["a", "b"]);
  });

  it("reports an identity lookup that did not answer", () => {
    given({ createdBy: undefined, authorError: new Error("no session") });

    const { result } = renderHook(() => useReachableProjects());

    expect(result.current.error).not.toBeNull();
    expect(result.current.isPending).toBe(false);
  });
});
