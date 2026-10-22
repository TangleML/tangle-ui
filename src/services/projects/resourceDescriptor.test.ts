import { describe, expect, it } from "vitest";

import {
  describeResource,
  documentResourceInput,
  pipelineRunResourceInput,
} from "./resourceDescriptor";
import type { ProjectResourceSummary } from "./types";

function row(
  metadata: Record<string, unknown> | null,
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "Churn model",
    entityId: null,
    metadata,
    createdBy: null,
    createdAt: new Date("2026-09-21T10:00:00Z"),
    updatedAt: new Date("2026-09-21T10:00:00Z"),
    ...overrides,
  };
}

describe("describeResource", () => {
  it("reads back a run as the run it names, and nothing more", () => {
    const input = pipelineRunResourceInput("42", "Run 42");

    expect(describeResource(row(input.metadata ?? null))).toEqual({
      type: "pipeline_run",
      target: { type: "run", identity: "id/42" },
    });
  });

  it("finds nothing to say about a row with no extra data", () => {
    expect(describeResource(row(null))).toBeUndefined();
    expect(describeResource(row({}))).toBeUndefined();
    expect(describeResource(row({ type: "" }))).toBeUndefined();
    expect(describeResource(row({ type: 7 }))).toBeUndefined();
  });

  /**
   * `data` is free-form and anyone may PATCH it, so a build that has
   * never heard of a row kind still has to render it as something.
   */
  it("passes an unfamiliar kind through rather than discarding the row", () => {
    expect(describeResource(row({ type: "sbom" }))).toEqual({ type: "sbom" });
  });

  it("ignores an identity that is not a target, rather than throwing past it", () => {
    expect(
      describeResource(row({ type: "pipeline", identity: "nonsense" })),
    ).toEqual({ type: "pipeline" });
    expect(
      describeResource(
        row({ type: "pipeline", identity: "pipeline://bogus/7" }),
      ),
    ).toEqual({ type: "pipeline" });
  });

  /** A run addressed by name is not expressible, so it must not parse as one. */
  it("rejects a target whose kind cannot take that identity", () => {
    expect(
      describeResource(row({ type: "pipeline_run", identity: "run://name/x" })),
    ).toEqual({ type: "pipeline_run" });
  });
});

describe("documentResourceInput", () => {
  it("files the body as the payload and says what the row is", () => {
    expect(documentResourceInput("Model card", "Trained on Q3")).toEqual({
      entity: "document",
      name: "Model card",
      payload: { content: "Trained on Q3" },
      metadata: { type: "document" },
    });
  });

  /** Both pages filter on `type`, so a document has to answer that question. */
  it("reads back as a document", () => {
    const input = documentResourceInput("Model card", "Body");

    expect(describeResource({ metadata: input.metadata ?? null })).toEqual({
      type: "document",
    });
  });
});
