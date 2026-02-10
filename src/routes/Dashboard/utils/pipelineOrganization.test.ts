import { describe, expect, it } from "vitest";

import {
  getAvailablePipelineTags,
  organizePipelines,
  type PipelineListItem,
} from "@/routes/Dashboard/utils/pipelineOrganization";

function makeItem(
  name: string,
  tags: string[] = [],
  pinned = false,
): PipelineListItem<string> {
  return {
    name,
    entry: name,
    metadata: { tags, pinned },
  };
}

describe("pipelineOrganization", () => {
  it("returns sorted unique tags", () => {
    const items = [
      makeItem("a", ["beta", "core"]),
      makeItem("b", ["core", "team-x"]),
    ];

    expect(getAvailablePipelineTags(items)).toEqual(["beta", "core", "team-x"]);
  });

  it("keeps one all-pipelines group for none grouping", () => {
    const items = [makeItem("a"), makeItem("b")];

    expect(organizePipelines(items, "none")).toEqual([
      { title: "All pipelines", items },
    ]);
  });

  it("groups pinned first when enabled", () => {
    const items = [
      makeItem("a", [], true),
      makeItem("b", [], false),
      makeItem("c", [], true),
    ];

    expect(organizePipelines(items, "pinned-first")).toEqual([
      { title: "Pinned", items: [items[0], items[2]] },
      { title: "Others", items: [items[1]] },
    ]);
  });

  it("groups by first tag and falls back to Untagged", () => {
    const items = [
      makeItem("a", ["data", "critical"]),
      makeItem("b", []),
      makeItem("c", ["alerts"]),
    ];

    expect(organizePipelines(items, "tag")).toEqual([
      { title: "alerts", items: [items[2]] },
      { title: "data", items: [items[0]] },
      { title: "Untagged", items: [items[1]] },
    ]);
  });
});
