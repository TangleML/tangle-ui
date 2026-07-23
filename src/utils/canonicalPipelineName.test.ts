import { describe, expect, it } from "vitest";

import type { TaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";

import { PIPELINE_CANONICAL_NAME_ANNOTATION } from "./annotations";
import {
  buildAnnotationsWithCanonicalName,
  extractCanonicalName,
} from "./canonicalPipelineName";

describe("extractCanonicalName()", () => {
  it("reads the canonical-name annotation from the task spec", () => {
    const taskSpec = {
      annotations: {
        [PIPELINE_CANONICAL_NAME_ANNOTATION]: "my-pipeline",
      },
    } as unknown as TaskSpecShape;

    expect(extractCanonicalName(taskSpec)).toBe("my-pipeline");
  });

  it("returns undefined when the annotation is absent", () => {
    const taskSpec = { annotations: {} } as unknown as TaskSpecShape;
    expect(extractCanonicalName(taskSpec)).toBeUndefined();
  });

  it("returns undefined when the task spec is undefined", () => {
    expect(extractCanonicalName(undefined)).toBeUndefined();
  });
});

describe("buildAnnotationsWithCanonicalName()", () => {
  it("wraps the canonical name under the canonical-name annotation key", () => {
    expect(buildAnnotationsWithCanonicalName("my-pipeline")).toEqual({
      [PIPELINE_CANONICAL_NAME_ANNOTATION]: "my-pipeline",
    });
  });

  it("returns an empty object when the canonical name is undefined", () => {
    expect(buildAnnotationsWithCanonicalName(undefined)).toEqual({});
  });

  it("returns an empty object for an empty string (falsy)", () => {
    expect(buildAnnotationsWithCanonicalName("")).toEqual({});
  });

  it("round-trips through extractCanonicalName", () => {
    const built = buildAnnotationsWithCanonicalName("round-trip");
    const taskSpec = { annotations: built } as unknown as TaskSpecShape;
    expect(extractCanonicalName(taskSpec)).toBe("round-trip");
  });
});
