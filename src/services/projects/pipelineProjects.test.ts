import { describe, expect, it } from "vitest";

import {
  holdsPipeline,
  pipelineResourceIn,
  remotePipelineResourceIn,
} from "./pipelineProjects";
import { localPipelineResourceInput } from "./resourceDescriptor";
import type { ProjectResourceSummary } from "./types";

function row(
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "Churn model",
    entityId: null,
    metadata: null,
    createdBy: "alice@example.com",
    createdAt: new Date("2026-09-09T10:00:00Z"),
    updatedAt: new Date("2026-09-09T10:00:00Z"),
    ...overrides,
  };
}

const pointerRow = (localName: string, localId?: string) =>
  row(
    localPipelineResourceInput({ localName, ...(localId ? { localId } : {}) }),
  );

describe("holdsPipeline", () => {
  it("recognises the pipeline a project points at", () => {
    expect(
      holdsPipeline([pointerRow("Churn model")], { localName: "Churn model" }),
    ).toBe(true);
  });

  it("does not claim a different pipeline", () => {
    expect(
      holdsPipeline([pointerRow("Something else")], {
        localName: "Churn model",
      }),
    ).toBe(false);
  });

  /** The pointer records the name at the time it was added, which a rename outlives. */
  it("still recognises a pipeline that has been renamed since", () => {
    expect(
      holdsPipeline([pointerRow("Churn model", "id-9")], {
        localName: "Churn model v2",
        localId: "id-9",
      }),
    ).toBe(true);
  });

  it("does not match two pipelines that merely shared a name", () => {
    expect(
      holdsPipeline([pointerRow("Churn model", "id-9")], {
        localName: "Churn model",
        localId: "id-10",
      }),
    ).toBe(false);
  });

  it("reads past the documents and backend pipelines beside it", () => {
    const resources = [
      row({ name: "readme.md" }),
      row({ entity: "pipeline", entityId: "pipeline-9", name: "Churn model" }),
      pointerRow("Churn model"),
    ];

    expect(holdsPipeline(resources, { localName: "Churn model" })).toBe(true);
  });

  /** A backend pipeline sharing the name is a different pipeline. */
  it("does not take a backend pipeline of the same name for this one", () => {
    expect(
      holdsPipeline(
        [row({ entity: "pipeline", entityId: "p-9", name: "Churn model" })],
        { localName: "Churn model" },
      ),
    ).toBe(false);
  });

  it("holds nothing when the project holds nothing", () => {
    expect(holdsPipeline([], { localName: "Churn model" })).toBe(false);
  });
});

/** Taking a pipeline back out of a project is a delete by resource id. */
describe("pipelineResourceIn", () => {
  it("hands back the row that points at the pipeline", () => {
    const wanted = { ...pointerRow("Churn model"), id: "resource-7" };

    expect(
      pipelineResourceIn([row({ id: "resource-1" }), wanted], {
        localName: "Churn model",
      }),
    ).toBe(wanted);
  });

  it("hands back nothing when no row points at it", () => {
    expect(
      pipelineResourceIn([pointerRow("Something else")], {
        localName: "Churn model",
      }),
    ).toBeUndefined();
  });
});

describe("remotePipelineResourceIn", () => {
  const PIPELINE_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const remoteRow = (entityId: string) =>
    row({ id: "resource-7", entity: "pipeline", entityId });

  it("hands back the row that names the backend pipeline", () => {
    const wanted = remoteRow(PIPELINE_ID);

    expect(
      remotePipelineResourceIn(
        [row({ id: "resource-1" }), wanted],
        PIPELINE_ID,
      ),
    ).toBe(wanted);
  });

  it("recognises the id however the backend spelled it", () => {
    const wanted = remoteRow(PIPELINE_ID.toUpperCase().replaceAll("-", ""));

    expect(remotePipelineResourceIn([wanted], PIPELINE_ID)).toBe(wanted);
  });

  it("does not take a browser pointer for it, even under the same name", () => {
    expect(
      remotePipelineResourceIn([pointerRow("Churn model")], PIPELINE_ID),
    ).toBeUndefined();
  });

  it("does not claim a different backend pipeline", () => {
    expect(
      remotePipelineResourceIn(
        [remoteRow("1b4e28ba-2fa1-11d2-883f-0016d3cca427")],
        PIPELINE_ID,
      ),
    ).toBeUndefined();
  });
});
