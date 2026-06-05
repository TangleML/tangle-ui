import { describe, expect, it } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Task } from "@/models/componentSpec/entities/task";

import { collectUsedComponentReferencesFromV2Spec } from "./collectUsedComponentReferencesFromV2Spec";

const task = ($id: string, digest: string, subgraphSpec?: ComponentSpec) =>
  new Task({ $id, name: $id, componentRef: { digest }, subgraphSpec });

describe("collectUsedComponentReferencesFromV2Spec", () => {
  it("collects unique digests from root tasks", () => {
    const spec = new ComponentSpec({
      name: "Root",
      tasks: [task("a", "d1"), task("b", "d2"), task("c", "d1")],
    });

    const refs = collectUsedComponentReferencesFromV2Spec(spec);
    expect(refs.map((r) => r.digest).sort()).toEqual(["d1", "d2"]);
  });

  it("recurses into subgraphs and collects their digests too", () => {
    const sub = new ComponentSpec({
      name: "Sub",
      tasks: [task("nested", "d-nested")],
    });
    const spec = new ComponentSpec({
      name: "Root",
      tasks: [task("root", "d-root"), task("group", "d-group", sub)],
    });

    const refs = collectUsedComponentReferencesFromV2Spec(spec);
    expect(refs.map((r) => r.digest).sort()).toEqual([
      "d-group",
      "d-nested",
      "d-root",
    ]);
  });
});
