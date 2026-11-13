import { beforeEach, describe, expect, it, vi } from "vitest";

import { setProjectItemArchived } from "@/routes/v2/pages/Tangent/services/projectArchive";

import { updateProjectMetadata } from "./updateProjectMetadata";

const services = vi.hoisted(() => ({
  getProject: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("@/services/projects/projectsService", () => ({
  getProject: services.getProject,
  updateProject: services.updateProject,
}));

type Metadata = Record<string, unknown> | null;

const nextTick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("updateProjectMetadata", () => {
  let saved: Record<string, { name: string; metadata: Metadata }>;

  beforeEach(() => {
    vi.clearAllMocks();
    saved = {
      "project-1": { name: "Churn", metadata: { theme: "dark" } },
      "project-2": { name: "Forecast", metadata: null },
    };
    // Slow on both legs, as the network is, so overlapping writers really do
    // overlap unless something lines them up.
    services.getProject.mockImplementation(async (id: string) => {
      const read = { id, ...saved[id] };
      await nextTick();
      return read;
    });
    services.updateProject.mockImplementation(
      async (id: string, input: { name?: string; metadata: Metadata }) => {
        await nextTick();
        saved[id] = { ...saved[id], ...input };
        return { id, ...saved[id] };
      },
    );
  });

  it("keeps both changes when two writers of different keys overlap", async () => {
    await Promise.all([
      updateProjectMetadata("project-1", (metadata) => ({
        ...metadata,
        tangentSharedFolderId: "folder-1",
      })),
      updateProjectMetadata("project-1", (metadata) => ({
        ...metadata,
        startingPrompt: "Why did it fail?",
      })),
    ]);

    expect(saved["project-1"].metadata).toEqual({
      theme: "dark",
      tangentSharedFolderId: "folder-1",
      startingPrompt: "Why did it fail?",
    });
  });

  it("keeps an archive and a rename that overlap", async () => {
    saved["project-1"].metadata = { provisionalName: true };
    const queryClient = { invalidateQueries: vi.fn() };

    await Promise.all([
      setProjectItemArchived(
        queryClient as never,
        "project-1",
        "run://id/r-1",
        true,
      ),
      updateProjectMetadata(
        "project-1",
        (metadata) => {
          const { provisionalName: _dropped, ...rest } = metadata ?? {};
          return rest;
        },
        { name: "Churn model" },
      ),
      setProjectItemArchived(
        queryClient as never,
        "project-1",
        "run://id/r-2",
        true,
      ),
    ]);

    expect(saved["project-1"]).toEqual({
      name: "Churn model",
      metadata: { tangentArchived: ["run://id/r-1", "run://id/r-2"] },
    });
  });

  it("applies each change to what the one before it saved", async () => {
    const seen: Metadata[] = [];
    const count = (metadata: Metadata) => {
      seen.push(metadata);
      return { count: Number(metadata?.count ?? 0) + 1 };
    };

    await Promise.all([
      updateProjectMetadata("project-2", count),
      updateProjectMetadata("project-2", count),
      updateProjectMetadata("project-2", count),
    ]);

    expect(seen).toEqual([null, { count: 1 }, { count: 2 }]);
    expect(saved["project-2"].metadata).toEqual({ count: 3 });
  });

  it("sends a new name with the metadata, and leaves the name alone otherwise", async () => {
    await updateProjectMetadata("project-1", () => ({}), { name: "Renamed" });
    await updateProjectMetadata("project-1", () => ({ a: 1 }));

    expect(services.updateProject).toHaveBeenNthCalledWith(1, "project-1", {
      name: "Renamed",
      metadata: {},
    });
    expect(services.updateProject).toHaveBeenNthCalledWith(2, "project-1", {
      metadata: { a: 1 },
    });
  });

  it("writes nothing when the change finds nothing to do, and says what it read", async () => {
    const result = await updateProjectMetadata("project-1", () => undefined, {
      name: "Unused",
    });

    expect(services.updateProject).not.toHaveBeenCalled();
    expect(result).toEqual({
      changed: false,
      project: { id: "project-1", name: "Churn", metadata: { theme: "dark" } },
    });
  });

  it("returns the project as saved", async () => {
    const result = await updateProjectMetadata("project-1", () => ({ a: 1 }));

    expect(result).toEqual({
      changed: true,
      project: { id: "project-1", name: "Churn", metadata: { a: 1 } },
    });
  });

  it("still saves a change queued behind one that failed", async () => {
    services.updateProject.mockRejectedValueOnce(new Error("Couldn't save"));

    const first = updateProjectMetadata("project-1", () => ({ first: true }));
    const second = updateProjectMetadata("project-1", (metadata) => ({
      ...metadata,
      second: true,
    }));

    await expect(first).rejects.toThrow("Couldn't save");
    await second;
    expect(saved["project-1"].metadata).toEqual({
      theme: "dark",
      second: true,
    });
  });

  it("fails without writing when the project can't be read", async () => {
    services.getProject.mockRejectedValueOnce(new Error("down"));

    await expect(
      updateProjectMetadata("project-1", () => ({ a: 1 })),
    ).rejects.toThrow("down");
    expect(services.updateProject).not.toHaveBeenCalled();
  });

  it("doesn't hold one project's change up behind another's", async () => {
    let release: () => void = () => undefined;
    services.updateProject.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve({}))),
    );
    const slow = updateProjectMetadata("project-1", () => ({ slow: true }));

    await updateProjectMetadata("project-2", () => ({ quick: true }));

    expect(saved["project-2"].metadata).toEqual({ quick: true });
    release();
    await slow;
  });
});
