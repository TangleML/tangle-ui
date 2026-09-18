import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { ProjectsApiError } from "@/services/projects/errors";
import { useProject } from "@/services/projects/useProjects";

import { useRunProjectContext } from "./useRunProjectContext";

const navigate = vi.fn();
let search: Record<string, unknown> = {};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useSearch: () => search,
}));

vi.mock("@/components/shared/Settings/useFlags", () => ({
  useFlagValue: vi.fn(),
}));

vi.mock("@/services/projects/useProjects", () => ({
  useProject: vi.fn(),
}));

const PROJECT = "035d6de5-23d6-402b-ad7e-9a7359194caf";

function mockProject(name: string | undefined, error: Error | null = null) {
  vi.mocked(useProject).mockReturnValue({
    data: name ? { id: PROJECT, name } : undefined,
    error,
  } as unknown as ReturnType<typeof useProject>);
}

const context = () => renderHook(() => useRunProjectContext()).result.current;

describe("useRunProjectContext", () => {
  beforeEach(() => {
    search = { projectId: PROJECT };
    vi.mocked(useFlagValue).mockReturnValue(true);
    mockProject("my project");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends the runs of this tab to the project it was opened from", () => {
    expect(context()).toMatchObject({
      projectId: PROJECT,
      projectName: "my project",
      projectIds: [PROJECT],
    });
  });

  it("attributes nothing when no project was carried", () => {
    search = {};

    expect(context()).toMatchObject({
      projectId: undefined,
      projectIds: [],
    });
  });

  /**
   * The id comes from a link or a bookmark. Attributing a run to a project
   * that does not exist cannot be undone, so it waits to be recognised.
   */
  it("attributes nothing to a project that no longer exists", () => {
    mockProject(undefined, new ProjectsApiError("Not found", 404));

    expect(context()).toMatchObject({
      projectId: undefined,
      projectIds: [],
    });
  });

  it("keeps the project while it is merely slow to answer", () => {
    mockProject(undefined);

    expect(context()).toMatchObject({
      projectId: PROJECT,
      projectName: undefined,
      projectIds: [PROJECT],
    });
  });

  it("keeps the project when the backend fails for some other reason", () => {
    mockProject(undefined, new ProjectsApiError("Nope", 500));

    expect(context().projectIds).toEqual([PROJECT]);
  });

  /** A shared link must not attribute runs in a UI that never showed a project. */
  it("ignores the project entirely while projects are switched off", () => {
    vi.mocked(useFlagValue).mockReturnValue(false);

    expect(context()).toMatchObject({ projectId: undefined, projectIds: [] });
    expect(useProject).toHaveBeenCalledWith(undefined);
  });

  it("stops sending runs to the project without disturbing the rest of the url", () => {
    search = { projectId: PROJECT, fileId: "file-9" };

    context().dismiss();

    const [{ search: next }] = navigate.mock.calls[0];
    expect(next({ projectId: PROJECT, fileId: "file-9" })).toEqual({
      projectId: undefined,
      fileId: "file-9",
    });
  });
});
