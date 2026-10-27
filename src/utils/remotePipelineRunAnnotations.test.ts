import { describe, expect, it } from "vitest";

import {
  LEGACY_REMOTE_PIPELINE_ID_ANNOTATION,
  REMOTE_PIPELINE_ID_ANNOTATION,
} from "./annotationKeys";
import { remotePipelineIdFromRunAnnotations } from "./remotePipelineRunAnnotations";

describe("remotePipelineIdFromRunAnnotations", () => {
  it("reads the backend pipeline id annotation", () => {
    expect(
      remotePipelineIdFromRunAnnotations({
        [REMOTE_PIPELINE_ID_ANNOTATION]: " pipeline-123 ",
      }),
    ).toBe("pipeline-123");
  });

  it("falls back to the legacy user pipeline id annotation", () => {
    expect(
      remotePipelineIdFromRunAnnotations({
        [LEGACY_REMOTE_PIPELINE_ID_ANNOTATION]: "legacy-123",
      }),
    ).toBe("legacy-123");
  });

  it("ignores absent or non-string values", () => {
    expect(remotePipelineIdFromRunAnnotations(null)).toBeUndefined();
    expect(
      remotePipelineIdFromRunAnnotations({
        [REMOTE_PIPELINE_ID_ANNOTATION]: 123,
        [LEGACY_REMOTE_PIPELINE_ID_ANNOTATION]: " ",
      }),
    ).toBeUndefined();
  });
});
