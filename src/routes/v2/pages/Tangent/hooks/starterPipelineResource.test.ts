import { describe, expect, it } from "vitest";

import { pointerOf } from "@/components/Project/localPipelinePointer";
import { parseResourceExtraData } from "@/routes/v2/pages/Tangent/workarea/resourceExtraData";
import type { ProjectResourceSummary } from "@/services/projects/types";

import {
  browserPipelineTarget,
  starterPipelineResourceInput,
} from "./starterPipelineResource";

const file = { id: "file-1", storageKey: "Churn model" };

function row(
  extraData: Record<string, unknown> | null,
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
  };
}

describe("starterPipelineResourceInput", () => {
  it("files the pipeline as the document the resources API accepts", () => {
    const input = starterPipelineResourceInput(file);

    expect(input.entity).toBe("document");
    expect(input.name).toBe("Churn model");
  });

  it("is readable by the project page, which resolves it as a pointer", () => {
    const input = starterPipelineResourceInput(file);

    expect(pointerOf(row(input.extraData ?? null))).toEqual({
      localName: "Churn model",
      localId: "file-1",
    });
  });

  it("is readable by Tangent, which resolves it as a workarea target", () => {
    const input = starterPipelineResourceInput(file);

    expect(parseResourceExtraData(input.extraData ?? null)).toMatchObject({
      type: "local_pipeline",
      identity: "pipeline://id/file-1",
    });
  });
});

describe("browserPipelineTarget", () => {
  it("opens a row added from Tangent by the target it recorded", () => {
    const target = browserPipelineTarget(
      row({ type: "local_pipeline", identity: "pipeline://id/file-7" }),
    );

    expect(target).toEqual({ type: "pipeline", identity: "id/file-7" });
  });

  it("opens a row added from the project page by its recorded id", () => {
    const target = browserPipelineTarget(
      row({ kind: "pipeline", localName: "Churn model", localId: "file-7" }),
    );

    expect(target).toEqual({ type: "pipeline", identity: "id/file-7" });
  });

  /** Most pipelines in this browser have no registry row to point at. */
  it("falls back to the name for a row that records no id", () => {
    const target = browserPipelineTarget(
      row({ kind: "pipeline", localName: "Churn model" }),
    );

    expect(target).toEqual({ type: "pipeline", identity: "name/Churn model" });
  });

  it("finds nothing to open in a document that is not a pipeline", () => {
    expect(browserPipelineTarget(row({ type: "notes" }))).toBeUndefined();
    expect(browserPipelineTarget(row(null))).toBeUndefined();
  });
});
