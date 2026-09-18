import { describe, expect, it } from "vitest";

import type { ProjectResourceSummary } from "@/services/projects/types";

import {
  claimsLocalPipeline,
  localPipelineInput,
  pointerOf,
  PointerTooLargeError,
} from "./localPipelinePointer";

function resource(
  overrides: Partial<ProjectResourceSummary> = {},
): ProjectResourceSummary {
  return {
    id: "resource-1",
    projectId: "project-1",
    entity: "document",
    name: "Churn model",
    entityId: null,
    extraData: {
      kind: "pipeline",
      storage: "browser",
      localName: "Churn model",
    },
    createdBy: "alice@example.com",
    createdAt: new Date("2026-09-09T10:00:00Z"),
    updatedAt: new Date("2026-09-09T10:00:00Z"),
    ...overrides,
  };
}

describe("pointerOf", () => {
  it("reads the pipeline a row points at", () => {
    expect(pointerOf(resource())).toEqual({ localName: "Churn model" });
  });

  it("keeps the id when the row carries one", () => {
    expect(
      pointerOf(
        resource({
          extraData: {
            kind: "pipeline",
            localName: "Churn model",
            localId: "id-9",
          },
        }),
      ),
    ).toEqual({ localName: "Churn model", localId: "id-9" });
  });

  it("treats an ordinary document as an ordinary document", () => {
    expect(pointerOf(resource({ extraData: null }))).toBeUndefined();
    expect(
      pointerOf(resource({ extraData: { kind: "note" } })),
    ).toBeUndefined();
  });

  it("does not claim a pipeline that really is on the backend", () => {
    expect(
      pointerOf(
        resource({
          entity: "pipeline",
          entityId: "0c3e0ad6-2f1e-4b0e-9a0e-1c0d2e3f4a5b",
          extraData: { kind: "pipeline" },
        }),
      ),
    ).toBeUndefined();
  });

  /** Anyone can PATCH extra_data, so a row may say anything at all. */
  it("degrades to an ordinary document when the pointer is unusable", () => {
    expect(
      pointerOf(resource({ extraData: { kind: "pipeline" } })),
    ).toBeUndefined();
    expect(
      pointerOf(resource({ extraData: { kind: "pipeline", localName: "" } })),
    ).toBeUndefined();
    expect(
      pointerOf(resource({ extraData: { kind: "pipeline", localName: 7 } })),
    ).toBeUndefined();
  });

  it("ignores an id that is not a string", () => {
    expect(
      pointerOf(
        resource({
          extraData: { kind: "pipeline", localName: "Churn model", localId: 7 },
        }),
      ),
    ).toEqual({ localName: "Churn model" });
  });
});

describe("claimsLocalPipeline", () => {
  it("answers for both kinds of row", () => {
    expect(claimsLocalPipeline(resource())).toBe(true);
    expect(claimsLocalPipeline(resource({ extraData: null }))).toBe(false);
  });

  /**
   * The weaker question on purpose. A row claiming to be a pipeline holds no
   * pipeline of its own however broken its pointer is, so removing it must not
   * be offered as a deletion.
   */
  it("still recognises a row whose pointer is unusable", () => {
    expect(
      claimsLocalPipeline(resource({ extraData: { kind: "pipeline" } })),
    ).toBe(true);
    expect(
      pointerOf(resource({ extraData: { kind: "pipeline" } })),
    ).toBeUndefined();
  });
});

describe("localPipelineInput", () => {
  it("files a pipeline as a resource carrying its own payload", () => {
    const input = localPipelineInput({ localName: "Churn model" });

    expect(input.entity).toBe("document");
    expect(input.name).toBe("Churn model");
  });

  /** A `document` may not name an `entity_id`, and the API rejects one that does. */
  it("never sends an entity_id", () => {
    expect(
      localPipelineInput({ localName: "Churn model" }).entityId,
    ).toBeUndefined();
  });

  /**
   * The point of a pointer is that nothing is copied, so there is nowhere for
   * the project's idea of the pipeline to drift from the pipeline itself.
   */
  it("copies none of the pipeline", () => {
    expect(localPipelineInput({ localName: "Churn model" }).payload).toEqual(
      {},
    );
  });

  it("says what it points at, and where that lives", () => {
    expect(
      localPipelineInput({ localName: "Churn model", localId: "id-9" })
        .extraData,
    ).toEqual({
      kind: "pipeline",
      storage: "browser",
      localName: "Churn model",
      localId: "id-9",
    });
  });

  it("leaves the id out rather than sending an empty one", () => {
    expect(
      localPipelineInput({ localName: "Churn model" }).extraData,
    ).not.toHaveProperty("localId");
  });

  it("fits inside what the API will store", () => {
    const input = localPipelineInput({
      localName: "p".repeat(255),
      localId: "0c3e0ad6-2f1e-4b0e-9a0e-1c0d2e3f4a5b",
    });

    expect(JSON.stringify(input.extraData).length).toBeLessThan(1024);
  });

  /** Better a sentence about the name than a bare rejection from the API. */
  it("refuses a name too long to record rather than letting the API refuse it", () => {
    expect(() => localPipelineInput({ localName: "p".repeat(2000) })).toThrow(
      PointerTooLargeError,
    );
  });

  it("round-trips through the row it describes", () => {
    const pointer = { localName: "Churn model", localId: "id-9" };
    const input = localPipelineInput(pointer);

    expect(
      pointerOf({
        entity: input.entity,
        entityId: null,
        extraData: input.extraData ?? null,
      }),
    ).toEqual(pointer);
  });
});
