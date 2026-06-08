import { beforeEach, describe, expect, it, vi } from "vitest";

import { LINEAGE_ORIGIN_ANNOTATION } from "@/utils/annotations";

import { scanPipelinesForLineage } from "./scanPipelinesForLineage";

vi.mock("@/utils/componentStore", () => ({
  getAllComponentFilesFromList: vi.fn(),
}));

const { getAllComponentFilesFromList } = await import("@/utils/componentStore");
const mockGetAll = vi.mocked(getAllComponentFilesFromList);

const ORIGIN = "https://x/train.yaml";
const TARGET = "edited-digest";

const lineageAnn = (originId: string) => ({
  [LINEAGE_ORIGIN_ANNOTATION]: JSON.stringify({ originId }),
});

const containerTask = (name: string, digest: string, originId?: string) => ({
  componentRef: { name, digest },
  annotations: originId ? lineageAnn(originId) : {},
});

const subgraphTask = (
  name: string,
  nestedTasks: Record<string, unknown>,
  originId?: string,
) => ({
  componentRef: {
    name,
    spec: { name, implementation: { graph: { tasks: nestedTasks } } },
  },
  annotations: originId ? lineageAnn(originId) : {},
});

const pipeline = (name: string, tasks: Record<string, unknown>) => ({
  componentRef: { spec: { name, implementation: { graph: { tasks } } } },
});

const asStore = (entries: Record<string, unknown>) =>
  new Map<string, any>(Object.entries(entries));

describe("scanPipelinesForLineage", () => {
  beforeEach(() => mockGetAll.mockReset());

  it("returns one target per (pipeline, depth) with pending/reconciled counts", async () => {
    mockGetAll.mockResolvedValue(
      asStore({
        "Pipeline A": pipeline("Pipeline A", {
          "Train old": containerTask("Train old", "old-digest", ORIGIN),
          "Train new": containerTask("Train new", TARGET, ORIGIN),
          Unrelated: containerTask("Unrelated", "z", "https://x/other.yaml"),
        }),
        "Pipeline B": pipeline("Pipeline B", {
          Nothing: containerTask("Nothing", "n"),
        }),
      }),
    );

    const results = await scanPipelinesForLineage(ORIGIN, TARGET);

    // One target: Pipeline A root level (Pipeline B has no matching tasks)
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      storageKey: "Pipeline A",
      pipelineName: "Pipeline A",
      subgraphPath: [],
      pendingCount: 1,
      reconciledCount: 1,
    });
    expect(results[0].tasks.map((t) => t.taskName).sort()).toEqual([
      "Train new",
      "Train old",
    ]);
  });

  it("creates separate targets for root and subgraph depths", async () => {
    mockGetAll.mockResolvedValue(
      asStore({
        "Pipeline C": pipeline("Pipeline C", {
          "Root train": containerTask("Root train", "old", ORIGIN),
          Group: subgraphTask("Group", {
            "Nested train": containerTask("Nested train", "old", ORIGIN),
          }),
        }),
      }),
    );

    const results = await scanPipelinesForLineage(ORIGIN, TARGET);

    // Two separate targets: root level and inside Group
    expect(results).toHaveLength(2);
    const root = results.find((r) => r.subgraphPath.length === 0)!;
    const nested = results.find((r) => r.subgraphPath.length > 0)!;

    expect(root.tasks[0].taskName).toBe("Root train");
    expect(nested.subgraphPath).toEqual(["Group"]);
    expect(nested.tasks[0].taskName).toBe("Nested train");
  });

  it("returns nothing when no pipeline shares the origin", async () => {
    mockGetAll.mockResolvedValue(
      asStore({
        "Pipeline D": pipeline("Pipeline D", {
          A: containerTask("A", "d", "https://x/other.yaml"),
        }),
      }),
    );

    expect(await scanPipelinesForLineage(ORIGIN, TARGET)).toEqual([]);
  });
});
