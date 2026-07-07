import { describe, expect, it } from "vitest";

import { recordNewSubgraphName } from "./editorTourBridge.utils";

const subgraph = (id: string, name: string) => ({
  $id: id,
  name,
  subgraphSpec: {},
});
const leaf = (id: string, name: string) => ({ $id: id, name });

describe("recordNewSubgraphName", () => {
  it("records every unseen subgraph and returns the last new name", () => {
    const seen = new Set<string>();
    const result = recordNewSubgraphName(seen, [
      subgraph("a", "Training"),
      subgraph("b", "Evaluation"),
    ]);
    expect(result).toBe("Evaluation");
    expect(seen).toEqual(new Set(["a", "b"]));
  });

  it("reports the name of a newly created subgraph", () => {
    const seen = new Set(["a", "b"]);
    const result = recordNewSubgraphName(seen, [
      subgraph("a", "Training"),
      subgraph("b", "Evaluation"),
      subgraph("c", "My Subgraph"),
    ]);
    expect(result).toBe("My Subgraph");
    expect(seen.has("c")).toBe(true);
  });

  it("ignores non-subgraph tasks", () => {
    const seen = new Set<string>();
    const result = recordNewSubgraphName(seen, [
      leaf("g", "Generate"),
      leaf("s", "Split"),
    ]);
    expect(result).toBeNull();
    expect(seen.size).toBe(0);
  });

  it("does not treat a re-surfaced subgraph as new after navigating away and back", () => {
    const seen = new Set<string>();
    const root = [subgraph("a", "Training"), subgraph("b", "Evaluation")];

    recordNewSubgraphName(seen, root);
    expect(recordNewSubgraphName(seen, [])).toBeNull();
    expect(recordNewSubgraphName(seen, root)).toBeNull();
  });
});
