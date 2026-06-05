import { describe, expect, it } from "vitest";

import type { ComponentSpec } from "./componentSpec";
import {
  type ComponentLineage,
  componentLineageSchema,
  EMBEDDED_LINEAGE_KEY,
  embeddedLineageOf,
  makeLineage,
  originIdOf,
  resolveLineageForRef,
} from "./lineage";

describe("originIdOf", () => {
  it("prefers url over digest", () => {
    expect(originIdOf({ url: "https://x/c.yaml", digest: "abc" })).toBe(
      "https://x/c.yaml",
    );
  });

  it("falls back to digest when there is no url", () => {
    expect(originIdOf({ digest: "abc" })).toBe("abc");
  });

  it("returns undefined when neither is present", () => {
    expect(originIdOf({ name: "Nameless" })).toBeUndefined();
  });
});

describe("makeLineage", () => {
  it("captures origin id, digest, and name", () => {
    expect(makeLineage({ digest: "abc", name: "Train" })).toEqual({
      originId: "abc",
      originDigest: "abc",
      originName: "Train",
    });
  });

  it("uses url as the origin id but keeps the digest separately", () => {
    expect(
      makeLineage({ url: "https://x/c.yaml", digest: "abc", name: "Train" }),
    ).toEqual({
      originId: "https://x/c.yaml",
      originDigest: "abc",
      originName: "Train",
    });
  });

  it("returns undefined when there is no stable identity", () => {
    expect(makeLineage({ name: "Nameless" })).toBeUndefined();
  });
});

describe("embeddedLineageOf", () => {
  const lineage: ComponentLineage = {
    originId: "https://x/c.yaml",
    originDigest: "abc",
    originName: "Train",
  };

  const specWith = (value: unknown): ComponentSpec => ({
    implementation: { container: { image: "x" } },
    metadata: { annotations: { [EMBEDDED_LINEAGE_KEY]: value } },
  });

  it("reads an embedded lineage object", () => {
    expect(embeddedLineageOf(specWith(lineage))).toEqual(lineage);
  });

  it("reads an embedded lineage stored as a JSON string", () => {
    expect(embeddedLineageOf(specWith(JSON.stringify(lineage)))).toEqual(
      lineage,
    );
  });

  it("returns undefined when absent or invalid", () => {
    expect(
      embeddedLineageOf({ implementation: { container: { image: "x" } } }),
    ).toBeUndefined();
    expect(embeddedLineageOf(specWith({ nope: true }))).toBeUndefined();
    expect(embeddedLineageOf(undefined)).toBeUndefined();
  });
});

describe("resolveLineageForRef", () => {
  it("prefers an embedded spec lineage over the ref's own identity", () => {
    const embedded: ComponentLineage = { originId: "origin-published" };
    const ref = {
      digest: "edited-digest",
      name: "Train",
      spec: {
        implementation: { container: { image: "x" } },
        metadata: { annotations: { [EMBEDDED_LINEAGE_KEY]: embedded } },
      } satisfies ComponentSpec,
    };
    expect(resolveLineageForRef(ref)).toEqual(embedded);
  });

  it("derives lineage from the ref when no embedded lineage exists", () => {
    expect(resolveLineageForRef({ digest: "abc", name: "Train" })).toEqual({
      originId: "abc",
      originDigest: "abc",
      originName: "Train",
    });
  });
});

describe("componentLineageSchema", () => {
  it("rejects an empty origin id", () => {
    expect(componentLineageSchema.safeParse({ originId: "" }).success).toBe(
      false,
    );
  });

  it("accepts a minimal lineage", () => {
    expect(componentLineageSchema.safeParse({ originId: "abc" }).success).toBe(
      true,
    );
  });
});
