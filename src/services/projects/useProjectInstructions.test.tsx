import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectResource, ProjectResourceSummary } from "./types";
import { useProjectInstructions } from "./useProjectInstructions";
import {
  useCreateProjectResource,
  useProjectResource,
  useProjectResources,
  useUpdateProjectResource,
} from "./useProjectResources";

const createResource = vi.fn();
const updateResource = vi.fn();

vi.mock("./useProjectResources", () => ({
  useProjectResources: vi.fn(),
  useProjectResource: vi.fn(),
  useCreateProjectResource: vi.fn(),
  useUpdateProjectResource: vi.fn(),
}));

function row(
  id: string,
  type: string,
  createdAt = "2026-09-21T10:00:00Z",
): ProjectResourceSummary {
  return {
    id,
    projectId: "project-1",
    entity: "document",
    name: "Instructions",
    entityId: null,
    extraData: { type },
    createdBy: null,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

function given(rows: ProjectResourceSummary[], body?: string) {
  vi.mocked(useProjectResources).mockReturnValue({
    data: { items: rows },
    isPending: false,
  } as unknown as ReturnType<typeof useProjectResources>);
  vi.mocked(useProjectResource).mockReturnValue({
    data:
      body === undefined
        ? undefined
        : ({ payload: { content: body } } as unknown as ProjectResource),
    isPending: false,
  } as unknown as ReturnType<typeof useProjectResource>);
}

const read = () => renderHook(() => useProjectInstructions("project-1")).result;

describe("useProjectInstructions", () => {
  beforeEach(() => {
    vi.mocked(useCreateProjectResource).mockReturnValue({
      mutate: createResource,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateProjectResource>);
    vi.mocked(useUpdateProjectResource).mockReturnValue({
      mutate: updateResource,
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateProjectResource>);
    given([]);
  });
  afterEach(() => vi.resetAllMocks());

  it("reads what the instructions document says", () => {
    given([row("r-1", "instructions")], "Prefer concise plans.");

    expect(read().current.instructions).toBe("Prefer concise plans.");
    expect(useProjectResource).toHaveBeenCalledWith("project-1", "r-1");
  });

  it("reads as empty for a project with no instructions", () => {
    given([row("r-1", "document")]);

    expect(read().current.instructions).toBe("");
    expect(useProjectResource).toHaveBeenCalledWith("project-1", undefined);
  });

  it("writes the first instructions as a new document", () => {
    read().current.save("Prefer concise plans.");

    expect(createResource).toHaveBeenCalledWith({
      entity: "document",
      name: "Instructions",
      payload: { content: "Prefer concise plans." },
      extraData: { type: "instructions" },
    });
  });

  it("writes later ones into the document already there", () => {
    given([row("r-1", "instructions")], "Old");

    read().current.save("New");

    expect(updateResource).toHaveBeenCalledWith({
      resourceId: "r-1",
      input: { payload: { content: "New" } },
    });
    expect(createResource).not.toHaveBeenCalled();
  });

  /** Two clients writing at once is the only way to get here; both must agree. */
  it("settles on the oldest when a project somehow holds two", () => {
    given(
      [
        row("newer", "instructions", "2026-09-21T10:00:00Z"),
        row("older", "instructions", "2026-09-02T10:00:00Z"),
      ],
      "Body",
    );

    read().current.save("New");

    expect(updateResource).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: "older" }),
    );
  });

  it("waits for the body before saying a project has no instructions", () => {
    vi.mocked(useProjectResources).mockReturnValue({
      data: { items: [row("r-1", "instructions")] },
      isPending: false,
    } as unknown as ReturnType<typeof useProjectResources>);
    vi.mocked(useProjectResource).mockReturnValue({
      data: undefined,
      isPending: true,
    } as unknown as ReturnType<typeof useProjectResource>);

    expect(read().current.isPending).toBe(true);
  });
});
