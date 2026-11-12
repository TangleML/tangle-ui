import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  archivedTargets,
  setProjectItemArchived,
  withArchived,
} from "./projectArchive";

const services = vi.hoisted(() => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("@/services/projects/projectsService", () => ({
  getProject: services.getProject,
  updateProject: services.updateProject,
}));

describe("project archive", () => {
  let saved: Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    saved = { theme: "dark" };
    services.getProject.mockImplementation(async () => ({ metadata: saved }));
    services.updateProject.mockImplementation(
      async (
        _id: string,
        { metadata }: { metadata: Record<string, unknown> },
      ) => {
        saved = metadata;
        return { metadata };
      },
    );
  });

  it("reads only the archived targets, ignoring anything malformed", () => {
    expect(
      archivedTargets({ tangentArchived: ["run://id/r-1", 7, null] }),
    ).toEqual(["run://id/r-1"]);
    expect(archivedTargets(null)).toEqual([]);
  });

  it("archives and restores a target, keeping the rest of the metadata", () => {
    const archived = withArchived(
      { startingSession: { prompt: "Hi" } },
      "run://id/r-1",
      true,
    );
    expect(archived).toEqual({
      startingSession: { prompt: "Hi" },
      tangentArchived: ["run://id/r-1"],
    });

    expect(withArchived(archived, "run://id/r-1", false)).toEqual({
      startingSession: { prompt: "Hi" },
      tangentArchived: [],
    });
  });

  it("archives a target once, however often it's asked", () => {
    const twice = withArchived(
      withArchived(null, "pipeline://id/p-1", true),
      "pipeline://id/p-1",
      true,
    );
    expect(archivedTargets(twice)).toEqual(["pipeline://id/p-1"]);
  });

  it("keeps every item when several are archived at once", async () => {
    await Promise.all([
      setProjectItemArchived("project-1", "run://id/r-1", true),
      setProjectItemArchived("project-1", "run://id/r-2", true),
      setProjectItemArchived("project-1", "run://id/r-3", true),
    ]);

    expect(saved).toEqual({
      theme: "dark",
      tangentArchived: ["run://id/r-1", "run://id/r-2", "run://id/r-3"],
    });
  });

  it("still saves a change queued behind one that failed", async () => {
    services.updateProject.mockRejectedValueOnce(new Error("Couldn't save"));

    const first = setProjectItemArchived("project-1", "run://id/r-1", true);
    const second = setProjectItemArchived("project-1", "run://id/r-2", true);

    await expect(first).rejects.toThrow("Couldn't save");
    await second;
    expect(archivedTargets(saved)).toEqual(["run://id/r-2"]);
  });
});
