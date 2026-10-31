import { describe, expect, it } from "vitest";

import { REMOTE_PIPELINE_ID_ANNOTATION } from "./annotationKeys";
import {
  remotePipelineIdFromRunAnnotations,
  resolvePipelineInspectPath,
} from "./remotePipelineRunAnnotations";

describe("remotePipelineIdFromRunAnnotations", () => {
  it("reads the backend pipeline id annotation", () => {
    expect(
      remotePipelineIdFromRunAnnotations({
        [REMOTE_PIPELINE_ID_ANNOTATION]: " pipeline-123 ",
      }),
    ).toBe("pipeline-123");
  });

  it("ignores the saved-pipeline search key, which runs never carry", () => {
    expect(
      remotePipelineIdFromRunAnnotations({
        "system/pipeline.id": "pipeline-123",
      }),
    ).toBeUndefined();
  });

  it("ignores absent or non-string values", () => {
    expect(remotePipelineIdFromRunAnnotations(null)).toBeUndefined();
    expect(
      remotePipelineIdFromRunAnnotations({
        [REMOTE_PIPELINE_ID_ANNOTATION]: 123,
      }),
    ).toBeUndefined();
    expect(
      remotePipelineIdFromRunAnnotations({
        [REMOTE_PIPELINE_ID_ANNOTATION]: " ",
      }),
    ).toBeUndefined();
  });
});

describe("resolvePipelineInspectPath", () => {
  it("prefers the remote pipeline editor path when annotations identify one", () => {
    expect(
      resolvePipelineInspectPath(
        { [REMOTE_PIPELINE_ID_ANNOTATION]: "remote-id" },
        "Local Name",
      ),
    ).toBe("/editor/pipeline/remote-id");
  });

  it("falls back to the named local pipeline path", () => {
    expect(resolvePipelineInspectPath({}, "Local Name")).toBe(
      "/editor/Local%20Name",
    );
  });

  it("returns nothing without a remote id or pipeline name", () => {
    expect(resolvePipelineInspectPath({}, undefined)).toBeUndefined();
  });
});
