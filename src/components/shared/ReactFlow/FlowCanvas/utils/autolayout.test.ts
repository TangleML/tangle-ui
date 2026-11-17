import type { Edge, Node } from "@xyflow/react";
import { describe, expect, test } from "vitest";

import { autoLayoutNodes, type LayoutAlgorithm } from "./autolayout";

const ALGORITHMS: LayoutAlgorithm[] = [
  "sugiyama",
  "sugiyama_centered",
  "digco",
  "dwyer",
];

const node = (id: string, width: number, height: number): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  measured: { width, height },
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}->${target}`,
  source,
  target,
});

const inputNode = (id: string) => node(id, 240, 160);
const tallTaskNode = (id: string, height: number) => node(id, 330, height);

const nodes: Node[] = [
  inputNode("raw_events"),
  inputNode("user_table"),
  inputNode("catalog_table"),
  inputNode("cache_table"),
  inputNode("model_name"),
  inputNode("model_version"),
  inputNode("experiment_name"),
  tallTaskNode("prepare_dataset", 1300),
  tallTaskNode("evaluate_a", 900),
  tallTaskNode("evaluate_b", 900),
  tallTaskNode("metrics_table_a", 400),
  tallTaskNode("metrics_table_b", 400),
  tallTaskNode("compute_metrics_a", 1100),
  tallTaskNode("compute_metrics_b", 1100),
  tallTaskNode("combine_metrics", 1100),
  node("output_a", 240, 140),
  node("output_b", 240, 140),
  node("metrics_output", 240, 140),
];

const edges: Edge[] = [
  edge("raw_events", "prepare_dataset"),
  edge("user_table", "prepare_dataset"),
  edge("catalog_table", "prepare_dataset"),
  edge("prepare_dataset", "evaluate_a"),
  edge("prepare_dataset", "evaluate_b"),
  edge("cache_table", "evaluate_a"),
  edge("model_name", "evaluate_a"),
  edge("model_name", "evaluate_b"),
  edge("model_version", "evaluate_a"),
  edge("experiment_name", "metrics_table_a"),
  edge("experiment_name", "metrics_table_b"),
  edge("evaluate_a", "compute_metrics_a"),
  edge("evaluate_b", "compute_metrics_b"),
  edge("metrics_table_a", "compute_metrics_a"),
  edge("metrics_table_b", "compute_metrics_b"),
  edge("prepare_dataset", "compute_metrics_a"),
  edge("compute_metrics_a", "combine_metrics"),
  edge("compute_metrics_b", "combine_metrics"),
  edge("evaluate_a", "output_a"),
  edge("evaluate_b", "output_b"),
  edge("combine_metrics", "metrics_output"),
];

const findOverlappingPairs = (laidOut: Node[]) => {
  const overlapping: string[] = [];
  laidOut.forEach((a, i) => {
    laidOut.slice(i + 1).forEach((b) => {
      const aWidth = a.measured?.width ?? 0;
      const aHeight = a.measured?.height ?? 0;
      const bWidth = b.measured?.width ?? 0;
      const bHeight = b.measured?.height ?? 0;
      const overlapsHorizontally =
        a.position.x < b.position.x + bWidth &&
        b.position.x < a.position.x + aWidth;
      const overlapsVertically =
        a.position.y < b.position.y + bHeight &&
        b.position.y < a.position.y + aHeight;
      if (overlapsHorizontally && overlapsVertically) {
        overlapping.push(`${a.id} / ${b.id}`);
      }
    });
  });
  return overlapping;
};

describe("autoLayoutNodes", () => {
  test.each(ALGORITHMS)(
    "keeps large measured nodes apart with %s",
    (algorithm) => {
      const laidOut = autoLayoutNodes(nodes, edges, algorithm);

      expect(findOverlappingPairs(laidOut)).toEqual([]);
    },
  );
});
