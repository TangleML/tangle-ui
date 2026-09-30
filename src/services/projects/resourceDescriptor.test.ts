import { describe, expect, it } from "vitest";

import {
  describeResource,
  DescriptorTooLargeError,
  documentResourceInput,
  localPipelinePointerOf,
  localPipelineResourceInput,
  namesLocalPipeline,
  pipelineRunResourceInput,
} from "./resourceDescriptor";
import type { ProjectResourceSummary } from "./types";

function row(
  extraData: Record<string, unknown> | null,
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "Churn model",
    entityId: null,
    extraData,
    createdBy: null,
    createdAt: new Date("2026-09-21T10:00:00Z"),
    updatedAt: new Date("2026-09-21T10:00:00Z"),
    ...overrides,
  };
}

const rowFor = (input: ReturnType<typeof localPipelineResourceInput>) =>
  row(input.extraData ?? null, { name: input.name ?? null });

describe("describeResource", () => {
  it("reads back what a browser pipeline was filed as", () => {
    const described = describeResource(
      rowFor(
        localPipelineResourceInput({
          localName: "Churn model",
          localId: "file-7",
        }),
      ),
    );

    expect(described).toEqual({
      type: "local_pipeline",
      storage: "browser",
      target: { type: "pipeline", identity: "id/file-7" },
      fallbackName: "Churn model",
    });
  });

  it("reads back a run, carrying the url it was given", () => {
    const input = pipelineRunResourceInput("42", "https://runs/42", "Run 42");

    expect(describeResource(row(input.extraData ?? null))).toEqual({
      type: "pipeline_run",
      target: { type: "run", identity: "id/42" },
      url: "https://runs/42",
    });
  });

  it("finds nothing to say about a row with no extra data", () => {
    expect(describeResource(row(null))).toBeUndefined();
    expect(describeResource(row({}))).toBeUndefined();
    expect(describeResource(row({ type: "" }))).toBeUndefined();
    expect(describeResource(row({ type: 7 }))).toBeUndefined();
  });

  /**
   * `extra_data` is free-form and anyone may PATCH it, so a build that has
   * never heard of a row kind still has to render it as something.
   */
  it("passes an unfamiliar kind through rather than discarding the row", () => {
    expect(describeResource(row({ type: "sbom" }))).toEqual({ type: "sbom" });
  });

  it("ignores an identity that is not a target, rather than throwing past it", () => {
    expect(
      describeResource(row({ type: "local_pipeline", identity: "nonsense" })),
    ).toEqual({ type: "local_pipeline" });
    expect(
      describeResource(
        row({ type: "local_pipeline", identity: "pipeline://bogus/7" }),
      ),
    ).toEqual({ type: "local_pipeline" });
  });

  /** A run addressed by name is not expressible, so it must not parse as one. */
  it("rejects a target whose kind cannot take that identity", () => {
    expect(
      describeResource(row({ type: "pipeline_run", identity: "run://name/x" })),
    ).toEqual({ type: "pipeline_run" });
  });
});

describe("localPipelinePointerOf", () => {
  it("prefers the id, so a recycled name cannot mislead it", () => {
    const pointer = localPipelinePointerOf(
      rowFor(
        localPipelineResourceInput({
          localName: "Churn model",
          localId: "file-7",
        }),
      ),
    );

    expect(pointer).toEqual({ localName: "Churn model", localId: "file-7" });
  });

  it("falls back to the name for a pipeline with no registry row", () => {
    expect(
      localPipelinePointerOf(
        rowFor(localPipelineResourceInput({ localName: "Churn model" })),
      ),
    ).toEqual({ localName: "Churn model" });
  });

  /**
   * The row's `name` is a label anyone may PATCH; `fallbackName` is what the
   * pipeline was called when it was attached, which is what finds it again.
   */
  it("takes the name from the descriptor, not from the row's label", () => {
    const input = localPipelineResourceInput({
      localName: "Churn model",
      localId: "file-7",
    });

    expect(
      localPipelinePointerOf(
        row(input.extraData ?? null, { name: "Renamed by someone" }),
      ),
    ).toEqual({ localName: "Churn model", localId: "file-7" });
  });

  it("finds no pipeline in a row that names something else", () => {
    expect(
      localPipelinePointerOf(row({ type: "pipeline_run" })),
    ).toBeUndefined();
    expect(localPipelinePointerOf(row(null))).toBeUndefined();
  });

  it("finds no pipeline in a row whose descriptor points nowhere", () => {
    expect(
      localPipelinePointerOf(row({ type: "local_pipeline" })),
    ).toBeUndefined();
  });
});

describe("namesLocalPipeline", () => {
  it("is true only of a row filed as one", () => {
    expect(
      namesLocalPipeline(
        rowFor(localPipelineResourceInput({ localName: "Churn model" })),
      ),
    ).toBe(true);
    expect(namesLocalPipeline(row({ type: "pipeline_run" }))).toBe(false);
    expect(namesLocalPipeline(row(null))).toBe(false);
  });
});

describe("localPipelineResourceInput", () => {
  it("files it as a document, which is what the api accepts", () => {
    const input = localPipelineResourceInput({ localName: "Churn model" });

    expect(input.entity).toBe("document");
    expect(input.entityId).toBeUndefined();
  });

  /** A uuid here would read as a backend pipeline to every other client. */
  it("never invents a backend id", () => {
    expect(
      localPipelineResourceInput({ localName: "Churn model" }).entityId,
    ).toBeUndefined();
  });

  it("refuses a name too long to record", () => {
    expect(() =>
      localPipelineResourceInput({ localName: "p".repeat(2000) }),
    ).toThrow(DescriptorTooLargeError);
  });
});

describe("documentResourceInput", () => {
  it("files the body as the payload and says what the row is", () => {
    expect(documentResourceInput("Model card", "Trained on Q3")).toEqual({
      entity: "document",
      name: "Model card",
      payload: { content: "Trained on Q3" },
      extraData: { type: "document" },
    });
  });

  /** Both pages filter on `type`, so a document has to answer that question. */
  it("reads back as a document", () => {
    const input = documentResourceInput("Model card", "Body");

    expect(describeResource({ extraData: input.extraData ?? null })).toEqual({
      type: "document",
    });
  });
});
