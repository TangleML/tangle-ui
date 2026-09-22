import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { addRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { useProject } from "@/services/projects/useProjects";

import { useTrackRecentlyViewedProject } from "./useTrackRecentlyViewedProject";

vi.mock("@/hooks/useRecentlyViewed", () => ({ addRecentlyViewed: vi.fn() }));
vi.mock("@/services/projects/useProjects", () => ({ useProject: vi.fn() }));

function projectResolvesTo(name: string | undefined) {
  vi.mocked(useProject).mockReturnValue({
    data: name === undefined ? undefined : { name },
  } as unknown as ReturnType<typeof useProject>);
}

describe("useTrackRecentlyViewedProject", () => {
  beforeEach(() => projectResolvesTo("Churn model"));
  afterEach(() => vi.resetAllMocks());

  it("records the visit once the project has a name", () => {
    renderHook(() => useTrackRecentlyViewedProject("p-1"));

    expect(addRecentlyViewed).toHaveBeenCalledWith({
      type: "project",
      id: "p-1",
      name: "Churn model",
    });
  });

  /** A half-loaded visit recorded as an empty row is worse than no row. */
  it("records nothing before the name arrives", () => {
    projectResolvesTo(undefined);

    renderHook(() => useTrackRecentlyViewedProject("p-1"));

    expect(addRecentlyViewed).not.toHaveBeenCalled();
  });

  it("records nothing without a project to record", () => {
    renderHook(() => useTrackRecentlyViewedProject(undefined));

    expect(addRecentlyViewed).not.toHaveBeenCalled();
  });
});
