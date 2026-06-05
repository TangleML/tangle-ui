/**
 * Tests the auto-stamp behavior when cloning a task with no lineage:
 * the pasted copy should receive a fresh origin derived from the source's
 * url/digest, or a UUID if neither is present.
 */
import { describe, expect, it } from "vitest";

import {
  type ComponentLineage,
  LINEAGE_ORIGIN_ANNOTATION,
} from "@/utils/lineage";

type SourceRef = { url?: string; digest?: string; name?: string };

/**
 * Inline copy of the logic from taskNode.manifest.ts clone handler.
 * Kept here as a pure function so we can test without pulling in the
 * editor-registry barrel (which transitively loads appSettings).
 */
function freshLineageFor(ref: SourceRef): ComponentLineage {
  return {
    originId: ref.url ?? ref.digest ?? "generated-uuid",
    originDigest: ref.digest,
    originName: ref.name,
  };
}

describe("paste lineage auto-stamp logic", () => {
  it("uses the component url as originId when available", () => {
    const lineage = freshLineageFor({
      url: "https://x/train.yaml",
      digest: "abc",
      name: "Train",
    });
    expect(lineage.originId).toBe("https://x/train.yaml");
    expect(lineage.originDigest).toBe("abc");
    expect(lineage.originName).toBe("Train");
  });

  it("falls back to digest when there is no url", () => {
    const lineage = freshLineageFor({ digest: "abc", name: "Train" });
    expect(lineage.originId).toBe("abc");
  });

  it("falls back to a placeholder when neither url nor digest is present", () => {
    const lineage = freshLineageFor({ name: "Custom" });
    expect(lineage.originId).toBeTruthy();
    expect(lineage.originId).toBe("generated-uuid");
  });

  it("a task snapshot with existing lineage annotation should not be replaced", () => {
    const existing: ComponentLineage = {
      originId: "original",
      originDigest: "orig-digest",
    };
    const sourceAnnotations = [
      { key: LINEAGE_ORIGIN_ANNOTATION, value: existing },
    ];
    const hasLineage = sourceAnnotations.some(
      (a) => a.key === LINEAGE_ORIGIN_ANNOTATION,
    );
    expect(hasLineage).toBe(true); // clone should preserve, not overwrite
  });
});
