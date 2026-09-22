import { describe, expect, it } from "vitest";

import {
  getRunSourcePipelineId,
  isPipelineId,
  SAVED_PIPELINE_ID_ANNOTATION,
  SOURCE_PIPELINE_ID_ANNOTATION,
} from "./pipelineRunSource";

const id = "00000000-0000-4000-8000-000000000001";

describe("pipeline run source", () => {
  it.each([SAVED_PIPELINE_ID_ANNOTATION, SOURCE_PIPELINE_ID_ANNOTATION])(
    "recognizes %s",
    (key) => expect(getRunSourcePipelineId({ [key]: id })).toBe(id),
  );

  it("prefers the backend's saved-pipeline identity", () => {
    expect(
      getRunSourcePipelineId({
        [SAVED_PIPELINE_ID_ANNOTATION]: id,
        [SOURCE_PIPELINE_ID_ANNOTATION]: "00000000-0000-4000-8000-000000000002",
      }),
    ).toBe(id);
  });

  it.each([undefined, null, "", "pipeline-name", "https://example.com"])(
    "rejects an invalid ID: %s",
    (value) => {
      expect(isPipelineId(value)).toBe(false);
      expect(
        getRunSourcePipelineId({
          [SOURCE_PIPELINE_ID_ANNOTATION]: value ?? null,
        }),
      ).toBeUndefined();
    },
  );

  it("leaves old unannotated runs unassociated", () => {
    expect(getRunSourcePipelineId()).toBeUndefined();
    expect(getRunSourcePipelineId({})).toBeUndefined();
  });
});
