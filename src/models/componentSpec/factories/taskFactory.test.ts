import { describe, expect, it } from "vitest";

import { LINEAGE_ORIGIN_ANNOTATION } from "@/utils/annotations";
import type { ComponentLineage } from "@/utils/lineage";
import { EMBEDDED_LINEAGE_KEY } from "@/utils/lineage";

import type { ComponentReference } from "../entities/types";
import type { IdGenerator } from "./idGenerator";
import { createTaskFromComponentRef } from "./taskFactory";

const stubIdGen: IdGenerator = { next: () => "task_test_1" };

describe("createTaskFromComponentRef lineage capture", () => {
  it("stamps lineage from the component's own identity", () => {
    const ref: ComponentReference = {
      name: "Train",
      digest: "origin-digest",
      url: "https://x/train.yaml",
    };

    const task = createTaskFromComponentRef(stubIdGen, ref, "Train");
    const lineage = task.annotations.get(LINEAGE_ORIGIN_ANNOTATION);

    expect(lineage).toEqual({
      originId: "https://x/train.yaml",
      originDigest: "origin-digest",
      originName: "Train",
    });
  });

  it("seeds lineage from an embedded spec lineage when present", () => {
    const embedded: ComponentLineage = { originId: "origin-published" };
    const ref: ComponentReference = {
      name: "Train",
      digest: "edited-digest",
      spec: {
        implementation: { container: { image: "x" } },
        metadata: { annotations: { [EMBEDDED_LINEAGE_KEY]: embedded } },
      },
    };

    const task = createTaskFromComponentRef(stubIdGen, ref, "Train");

    expect(task.annotations.get(LINEAGE_ORIGIN_ANNOTATION)).toEqual(embedded);
  });

  it("leaves lineage unset when the ref has no stable identity", () => {
    const ref: ComponentReference = { name: "Nameless" };

    const task = createTaskFromComponentRef(stubIdGen, ref, "Nameless");

    expect(task.annotations.has(LINEAGE_ORIGIN_ANNOTATION)).toBe(false);
  });
});
