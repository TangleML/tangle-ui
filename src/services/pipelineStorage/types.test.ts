import { describe, expect, it } from "vitest";

import { getEditorPipelineIdentity, type RemotePipelineRef } from "./types";

const ref: RemotePipelineRef = {
  source: "remote",
  backendUrl: "https://backend.example.com",
  pipelineId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
};

describe("getEditorPipelineIdentity", () => {
  it.each([
    ref.pipelineId.toUpperCase(),
    ref.pipelineId.replaceAll("-", ""),
    `{${ref.pipelineId}}`,
    `urn:uuid:${ref.pipelineId}`,
  ])("shares one identity for UUID variant %s", (pipelineId) => {
    expect(getEditorPipelineIdentity({ ...ref, pipelineId })).toBe(
      getEditorPipelineIdentity(ref),
    );
  });

  it("keeps distinct pipelines and backends separate", () => {
    const identity = getEditorPipelineIdentity(ref);
    expect(
      getEditorPipelineIdentity({
        ...ref,
        pipelineId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
      }),
    ).not.toBe(identity);
    expect(
      getEditorPipelineIdentity({
        ...ref,
        backendUrl: "https://other.example.com",
      }),
    ).not.toBe(identity);
  });

  it("preserves non-UUID IDs", () => {
    expect(
      getEditorPipelineIdentity({ ...ref, pipelineId: "Pipeline-1" }),
    ).not.toBe(getEditorPipelineIdentity({ ...ref, pipelineId: "pipeline-1" }));
  });
});
