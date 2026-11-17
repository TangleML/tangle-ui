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
  inputNode("judge_source_table"),
  inputNode("upi_assignments_table"),
  inputNode("product_summary_table"),
  inputNode("precision_cache_table"),
  inputNode("model_name"),
  inputNode("agent_version"),
  inputNode("experiment_name"),
  tallTaskNode("prepare_validation_clusters", 1300),
  tallTaskNode("precision_judge", 900),
  tallTaskNode("world_precision", 900),
  tallTaskNode("v4_metrics_table", 400),
  tallTaskNode("v6_metrics_table", 400),
  tallTaskNode("calculate_v4_metrics", 1100),
  tallTaskNode("calculate_v6_metrics", 1100),
  tallTaskNode("combine_metrics", 1100),
  node("v4_output", 240, 140),
  node("v6_output", 240, 140),
  node("metrics_output", 240, 140),
];

const edges: Edge[] = [
  edge("judge_source_table", "prepare_validation_clusters"),
  edge("upi_assignments_table", "prepare_validation_clusters"),
  edge("product_summary_table", "prepare_validation_clusters"),
  edge("prepare_validation_clusters", "precision_judge"),
  edge("prepare_validation_clusters", "world_precision"),
  edge("precision_cache_table", "precision_judge"),
  edge("model_name", "precision_judge"),
  edge("model_name", "world_precision"),
  edge("agent_version", "precision_judge"),
  edge("experiment_name", "v4_metrics_table"),
  edge("experiment_name", "v6_metrics_table"),
  edge("precision_judge", "calculate_v4_metrics"),
  edge("world_precision", "calculate_v6_metrics"),
  edge("v4_metrics_table", "calculate_v4_metrics"),
  edge("v6_metrics_table", "calculate_v6_metrics"),
  edge("prepare_validation_clusters", "calculate_v4_metrics"),
  edge("calculate_v4_metrics", "combine_metrics"),
  edge("calculate_v6_metrics", "combine_metrics"),
  edge("precision_judge", "v4_output"),
  edge("world_precision", "v6_output"),
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
