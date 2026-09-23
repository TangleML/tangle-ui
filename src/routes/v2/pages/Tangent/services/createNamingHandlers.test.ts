import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  listProjectResources,
  updateProjectResource,
} from "@/services/projects/projectResourcesService";
import { getProject, updateProject } from "@/services/projects/projectsService";
import type {
  Project,
  ProjectResourceSummary,
} from "@/services/projects/types";

import { createNamingHandlers } from "./createNamingHandlers";

vi.mock("@/services/projects/projectsService", () => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("@/services/projects/projectResourcesService", () => ({
  listProjectResources: vi.fn(),
  updateProjectResource: vi.fn(),
}));

const onRenamed = vi.fn().mockResolvedValue(undefined);
const getPipelineState = vi.fn();
const setPipelineName = vi.fn().mockResolvedValue({ success: true });

// `null` rather than `undefined` for "no session": passing undefined to an
// optional parameter takes its default, which is the session.
function handlers(sessionId: string | null = "sess-1", { canvas = true } = {}) {
  return createNamingHandlers({
    projectId: "project-1",
    getActiveSessionId: () => sessionId ?? undefined,
    getPipelineBridge: () =>
      canvas ? { getPipelineState, setPipelineName } : undefined,
    onRenamed,
  });
}

function mockProject(extraData: Record<string, unknown> | null): void {
  vi.mocked(getProject).mockResolvedValue({
    id: "project-1",
    name: "Project 3",
    extraData,
  } as Project);
}

function sessionRow(
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "row-1",
    projectId: "project-1",
    entity: "agent_session",
    name: null,
    entityId: "sess-1",
    extraData: null,
    createdBy: null,
    createdAt: new Date("2026-09-23T10:00:00Z"),
    updatedAt: new Date("2026-09-23T10:00:00Z"),
    ...overrides,
  };
}

function mockSessionRows(...rows: ProjectResourceSummary[]): void {
  vi.mocked(listProjectResources).mockResolvedValue({
    items: rows,
    nextPageToken: null,
    totalCount: rows.length,
  });
}

describe("renameProject", () => {
  beforeEach(() => {
    onRenamed.mockClear();
  });
  afterEach(() => vi.resetAllMocks());

  it("replaces a name nobody chose", async () => {
    mockProject({ provisionalName: true });

    await expect(handlers().renameProject("Churn model")).resolves.toEqual({
      renamed: true,
    });
    expect(updateProject).toHaveBeenCalledWith("project-1", {
      name: "Churn model",
      extraData: {},
    });
  });

  /** Renaming it back every session would be worse than never naming it. */
  it("leaves a name someone chose alone", async () => {
    mockProject(null);

    await expect(handlers().renameProject("Churn model")).resolves.toEqual({
      renamed: false,
    });
    expect(updateProject).not.toHaveBeenCalled();
  });

  it("will not rename a project it already named", async () => {
    mockProject({ provisionalName: true });
    await handlers().renameProject("Churn model");

    mockProject({});
    await expect(handlers().renameProject("Churn model v2")).resolves.toEqual({
      renamed: false,
    });
    expect(updateProject).toHaveBeenCalledTimes(1);
  });

  it("keeps the rest of the project's data", async () => {
    mockProject({ provisionalName: true, startingModel: "openai/gpt-5.6" });

    await handlers().renameProject("Churn model");

    expect(updateProject).toHaveBeenCalledWith("project-1", {
      name: "Churn model",
      extraData: { startingModel: "openai/gpt-5.6" },
    });
  });

  it("shows the new name without a reload", async () => {
    mockProject({ provisionalName: true });

    await handlers().renameProject("Churn model");

    expect(onRenamed).toHaveBeenCalled();
  });
});

describe("nameSession", () => {
  beforeEach(() => {
    onRenamed.mockClear();
  });
  afterEach(() => vi.resetAllMocks());

  it("names the row belonging to the session it was called from", async () => {
    mockSessionRows(
      sessionRow({ id: "row-other", entityId: "sess-other" }),
      sessionRow(),
    );

    await handlers().nameSession("Fix the churn run");

    expect(updateProjectResource).toHaveBeenCalledWith("project-1", "row-1", {
      name: "Fix the churn run",
    });
    expect(onRenamed).toHaveBeenCalled();
  });

  it("renames a session that was already named", async () => {
    mockSessionRows(sessionRow({ name: "First guess" }));

    await handlers().nameSession("Fix the churn run");

    expect(updateProjectResource).toHaveBeenCalledWith("project-1", "row-1", {
      name: "Fix the churn run",
    });
  });

  it("says so when the session is not attached yet", async () => {
    mockSessionRows();

    await expect(handlers().nameSession("Anything")).rejects.toThrow(
      "This session is not attached to the project yet.",
    );
    expect(updateProjectResource).not.toHaveBeenCalled();
  });

  it("asks the backend nothing when there is no session to name", async () => {
    await expect(handlers(null).nameSession("Anything")).rejects.toThrow(
      "This session is not attached to the project yet.",
    );
    expect(listProjectResources).not.toHaveBeenCalled();
  });

  describe("namePipeline", () => {
    /** One call has to move the spec, the file and the row together. */
    it("renames a pipeline nobody has named through the open canvas", async () => {
      getPipelineState.mockResolvedValue({ nameIsProvisional: true });

      await expect(handlers().namePipeline("Churn model")).resolves.toEqual({
        renamed: true,
      });
      expect(setPipelineName).toHaveBeenCalledWith("Churn model");
      expect(onRenamed).toHaveBeenCalled();
    });

    it("leaves a pipeline someone named alone", async () => {
      getPipelineState.mockResolvedValue({ nameIsProvisional: undefined });

      await expect(handlers().namePipeline("Churn model")).resolves.toEqual({
        renamed: false,
      });
      expect(setPipelineName).not.toHaveBeenCalled();
    });

    it("answers rather than throwing when no pipeline is open", async () => {
      await expect(
        handlers("sess-1", { canvas: false }).namePipeline("Churn model"),
      ).resolves.toEqual({ renamed: false });
      expect(getPipelineState).not.toHaveBeenCalled();
    });
  });
});
