import { describe, expect, it } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Task } from "@/models/componentSpec/entities/task";
import { LINEAGE_ORIGIN_ANNOTATION } from "@/utils/annotations";
import type { ComponentLineage } from "@/utils/lineage";

import { collectLineageUsages } from "./collectLineageUsages";

const ORIGIN = "https://x/train.yaml";

function taskWithLineage(
  $id: string,
  name: string,
  digest: string | undefined,
  lineage: ComponentLineage | undefined,
  subgraphSpec?: ComponentSpec,
): Task {
  const task = new Task({
    $id,
    name,
    componentRef: { digest },
    subgraphSpec,
  });
  if (lineage) {
    task.annotations.set(LINEAGE_ORIGIN_ANNOTATION, lineage);
  }
  return task;
}

describe("collectLineageUsages", () => {
  it("matches by origin id even when digests have diverged", () => {
    const spec = new ComponentSpec({
      name: "Pipeline",
      tasks: [
        taskWithLineage("a", "Train A", "digest-original", {
          originId: ORIGIN,
          originDigest: "digest-original",
        }),
        taskWithLineage("b", "Train B", "digest-edited", {
          originId: ORIGIN,
          originDigest: "digest-original",
        }),
        taskWithLineage("c", "Other", "other-digest", {
          originId: "https://x/other.yaml",
        }),
        taskWithLineage("d", "No lineage", "loose-digest", undefined),
      ],
    });

    const matches = collectLineageUsages(spec, ORIGIN);

    expect(matches.map((m) => m.taskId)).toEqual(["a", "b"]);
    expect(matches[1]).toMatchObject({
      taskId: "b",
      taskName: "Train B",
      digest: "digest-edited",
      subgraphPath: [],
    });
  });

  it("recurses into subgraphs and records the subgraph path", () => {
    const nested = new ComponentSpec({
      name: "Sub",
      tasks: [
        taskWithLineage("nested", "Nested Train", "digest-nested", {
          originId: ORIGIN,
        }),
      ],
    });

    const spec = new ComponentSpec({
      name: "Pipeline",
      tasks: [
        taskWithLineage("root", "Root Train", "digest-root", {
          originId: ORIGIN,
        }),
        taskWithLineage("group", "Group", undefined, undefined, nested),
      ],
    });

    const matches = collectLineageUsages(spec, ORIGIN);

    expect(matches.map((m) => m.taskId)).toEqual(["root", "nested"]);
    expect(matches[1].subgraphPath).toEqual(["Group"]);
  });

  it("returns no matches when nothing shares the origin", () => {
    const spec = new ComponentSpec({
      name: "Pipeline",
      tasks: [
        taskWithLineage("a", "A", "d", { originId: "https://x/other.yaml" }),
      ],
    });

    expect(collectLineageUsages(spec, ORIGIN)).toEqual([]);
  });
});
