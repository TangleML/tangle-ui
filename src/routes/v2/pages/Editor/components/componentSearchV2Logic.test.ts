import { describe, expect, it } from "vitest";

import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";
import {
  buildSearchIndex,
  type ComponentSearchSource,
  type LexicalMatch,
  type SourcedReference,
} from "@/services/componentSearchIndex";
import type { RerankResult } from "@/services/naturalLanguageComponentSearchService";
import type { ComponentLibrary } from "@/types/componentLibrary";
import type {
  ComponentReference,
  HydratedComponentReference,
} from "@/utils/componentSpec";

import {
  buildAiCandidateMatches,
  buildLexicalMatches,
  buildResultFolders,
  buildResults,
  buildSourcedHydratedReferences,
  collectAllSourcedReferences,
  PUBLISHED_SOURCE,
  registeredLibrariesFingerprint,
  rerankedMatches,
  USER_SOURCE,
} from "./componentSearchV2Logic";

function ref(digest: string, name = digest): ComponentReference {
  return {
    digest,
    name,
    spec: {
      name,
      description: name,
      inputs: [],
      outputs: [],
      implementation: { container: { image: "x" } },
    },
  };
}

function hydrated(digest: string, name = digest): HydratedComponentReference {
  return { digest, name, spec: ref(digest, name).spec!, text: name };
}

function source(
  kind: ComponentSearchSource["kind"],
  id: string = kind,
  label: string = kind,
): ComponentSearchSource {
  return { kind, id, label };
}

function match(
  digest: string,
  src: ComponentSearchSource = source("standard"),
): LexicalMatch {
  return {
    reference: ref(digest),
    digest,
    name: digest,
    source: src,
    matchedFields: [],
  };
}

function library(id: string, knownDigests: string[]): StoredLibrary {
  return { id, name: id, type: "yaml", knownDigests };
}

describe("registeredLibrariesFingerprint", () => {
  it("returns a sentinel while libraries are still loading", () => {
    expect(registeredLibrariesFingerprint(undefined)).toBe("loading");
  });

  it("is stable regardless of library or digest ordering", () => {
    const a = registeredLibrariesFingerprint([
      library("lib-b", ["d2", "d1"]),
      library("lib-a", ["d3"]),
    ]);
    const b = registeredLibrariesFingerprint([
      library("lib-a", ["d3"]),
      library("lib-b", ["d1", "d2"]),
    ]);
    expect(a).toBe(b);
  });

  it("changes when a library's known digests change", () => {
    const before = registeredLibrariesFingerprint([library("lib-a", ["d1"])]);
    const after = registeredLibrariesFingerprint([
      library("lib-a", ["d1", "d2"]),
    ]);
    expect(before).not.toBe(after);
  });

  it("changes when non-secret configuration fields change", () => {
    const before = registeredLibrariesFingerprint([
      {
        ...library("lib-a", ["d1"]),
        configuration: { repo_name: "old/repo", token: "secret" },
      },
    ]);
    const after = registeredLibrariesFingerprint([
      {
        ...library("lib-a", ["d1"]),
        configuration: { repo_name: "new/repo", token: "secret" },
      },
    ]);
    expect(before).not.toBe(after);
    expect(before).not.toContain("secret");
  });
});

describe("collectAllSourcedReferences", () => {
  it("dedupes by digest, keeping the first source that introduced it", () => {
    const result = collectAllSourcedReferences({
      standardLibrary: undefined,
      publishedRefs: [ref("dup"), ref("pub-only")],
      registeredSourced: [
        { reference: ref("dup"), source: source("registered") },
      ],
      userFolder: { components: [ref("dup"), ref("user-only")] },
    });

    expect(result.map((item) => item.reference.digest)).toEqual([
      "dup",
      "pub-only",
      "user-only",
    ]);
    // First writer wins: "dup" came in via the published source.
    expect(result[0]?.source).toBe(PUBLISHED_SOURCE);
  });

  it("drops references without a digest", () => {
    const result = collectAllSourcedReferences({
      standardLibrary: undefined,
      publishedRefs: [{ name: "no-digest" }],
      registeredSourced: [],
      userFolder: undefined,
    });
    expect(result).toEqual([]);
  });
});

describe("buildSourcedHydratedReferences", () => {
  it("re-attaches each hydrated reference to its original source by digest", () => {
    const sourcedReferences: SourcedReference[] = [
      { reference: ref("a"), source: source("standard") },
      { reference: ref("b"), source: USER_SOURCE },
    ];
    const result = buildSourcedHydratedReferences({
      sourcedReferences,
      hydratedReferences: [hydrated("b"), hydrated("a"), hydrated("unknown")],
    });

    expect(
      result.map((item) => [item.reference.digest, item.source.kind]),
    ).toEqual([
      ["b", "user"],
      ["a", "standard"],
    ]);
  });
});

describe("rerankedMatches", () => {
  const base = [match("a"), match("b"), match("c")];

  it("returns the base order untouched when there is no rerank data", () => {
    expect(rerankedMatches(undefined, base)).toBe(base);
    expect(rerankedMatches({ matches: [] }, base)).toBe(base);
  });

  it("orders ranked matches, carries unranked, and pushes excluded to the end", () => {
    const rerankData: RerankResult = {
      matches: [
        { id: "c", score: 0.9, reason: "" },
        { id: "a", score: 0.005, reason: "" }, // excluded (<= threshold)
        { id: "ghost", score: 0.8, reason: "" }, // not in base — ignored
      ],
    };
    // c ranked first; b unranked (carried); a excluded (last).
    expect(rerankedMatches(rerankData, base).map((m) => m.digest)).toEqual([
      "c",
      "b",
      "a",
    ]);
  });
});

describe("buildResults", () => {
  const displayed = [match("a"), match("b"), match("c")];

  it("badges only items scored above the exclusion threshold", () => {
    const scores = new Map([
      ["a", 0.9],
      ["b", 0.0], // model-excluded
      // "c" was never scored
    ]);
    const results = buildResults(displayed, scores, true);
    expect(results.map((r) => r.rerankScore)).toEqual([
      0.9,
      undefined,
      undefined,
    ]);
  });

  it("never badges when rerank is not active", () => {
    const scores = new Map([["a", 0.9]]);
    const results = buildResults(displayed, scores, false);
    expect(results.every((r) => r.rerankScore === undefined)).toBe(true);
  });
});

describe("buildResultFolders", () => {
  it("groups user/published/registered results and includes the standard tree", () => {
    const standardLibrary: ComponentLibrary = {
      folders: [{ name: "ML", components: [ref("std-1")] }],
    };
    const folders = buildResultFolders({
      results: [
        { reference: ref("u1"), source: USER_SOURCE },
        { reference: ref("p1"), source: PUBLISHED_SOURCE },
        {
          reference: ref("r1"),
          source: source("registered", "lib-z", "Zebra"),
        },
        { reference: ref("r2"), source: source("registered", "lib-a", "Acme") },
      ],
      standardLibrary,
    });

    const names = folders.map((f) => f.name);
    expect(names).toEqual([
      "User Components",
      "Published Components",
      "Standard library",
      "Connected libraries",
    ]);

    const connected = folders.find((f) => f.name === "Connected libraries");
    // Registered libraries are grouped by label, sorted alphabetically.
    expect(connected?.folders?.map((f) => f.name)).toEqual(["Acme", "Zebra"]);
  });
});

describe("buildLexicalMatches / buildAiCandidateMatches", () => {
  const index = buildSearchIndex([
    { reference: ref("zebra"), source: source("standard") },
    { reference: ref("alpha"), source: source("standard") },
  ]);

  it("returns an alphabetical browse list for an empty query", () => {
    expect(buildLexicalMatches(index, "").map((m) => m.digest)).toEqual([
      "alpha",
      "zebra",
    ]);
  });

  it("returns no AI candidates for an empty query", () => {
    expect(buildAiCandidateMatches(index, "")).toEqual([]);
  });

  it("returns no AI candidates when literal search finds nothing", () => {
    const candidates = buildAiCandidateMatches(index, "qqzznomatch");
    expect(candidates).toEqual([]);
  });

  it("adds source-diverse lexical candidates beyond the top lexical hits", () => {
    const broadIndex = buildSearchIndex([
      ...Array.from({ length: 100 }, (_, i) => ({
        reference: ref(`train-${i}`, `train_${i}`),
        source: source("standard"),
      })),
      {
        reference: ref("user-upload", "train_user_upload"),
        source: USER_SOURCE,
      },
    ]);

    const candidates = buildAiCandidateMatches(broadIndex, "train");

    expect(candidates.length).toBeLessThanOrEqual(80);
    expect(candidates.map((candidate) => candidate.digest)).toContain(
      "user-upload",
    );
  });
});
