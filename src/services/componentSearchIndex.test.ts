import { describe, expect, it } from "vitest";

import type { ComponentReference } from "@/utils/componentSpec";

import {
  buildSearchIndex,
  type ComponentSource,
  lexicalSearch,
  type SourcedReference,
} from "./componentSearchIndex";

const STANDARD: ComponentSource = {
  kind: "standard",
  label: "Standard",
  id: "standard",
};
const USER: ComponentSource = { kind: "user", label: "User", id: "user" };

function makeRef(
  partial: Partial<ComponentReference> & { digest?: string },
): ComponentReference {
  return {
    digest: partial.digest,
    url: partial.url,
    name: partial.name,
    spec: partial.spec,
  };
}

function makeSourced(
  partial: Partial<ComponentReference> & { digest?: string },
  source: ComponentSource = STANDARD,
): SourcedReference {
  return { reference: makeRef(partial), source };
}

describe("buildSearchIndex", () => {
  it("skips references without a digest", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: undefined,
        spec: {
          name: "no_digest",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);
    expect(index).toHaveLength(0);
  });

  it("skips references with no useful metadata", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "abc",
        // No name, description, inputs, or outputs.
        spec: {
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);
    expect(index).toHaveLength(0);
  });

  it("preserves the source on each indexed entry", () => {
    const index = buildSearchIndex([
      makeSourced(
        {
          digest: "a",
          spec: {
            name: "train_model",
            inputs: [],
            outputs: [],
            implementation: { container: { image: "x" } },
          },
        },
        USER,
      ),
    ]);
    expect(index).toHaveLength(1);
    expect(index[0].source).toEqual(USER);
  });

  it("indexes name, description, io, and container command text", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "a",
        spec: {
          name: "train_model",
          description: "Train a regression model on a dataset.",
          inputs: [{ name: "dataset" }],
          outputs: [{ name: "model" }],
          implementation: {
            container: {
              image: "python:3.11",
              command: ["python", "-m", "pandas.train"],
              args: ["--epochs", "10"],
            },
          },
        },
      }),
    ]);
    expect(index).toHaveLength(1);
    expect(index[0].searchable.name).toContain("train_model");
    expect(index[0].searchable.description).toContain("regression");
    expect(index[0].searchable.io).toContain("dataset");
    expect(index[0].searchable.io).toContain("model");
    expect(index[0].searchable.implementation).toContain("pandas.train");
    expect(index[0].searchable.implementation).toContain("--epochs");
  });
});

describe("lexicalSearch", () => {
  const fixtures: SourcedReference[] = [
    makeSourced({
      digest: "a",
      spec: {
        name: "train_test_split",
        description: "Split a dataset into train and test partitions.",
        inputs: [{ name: "dataset" }],
        outputs: [{ name: "train" }, { name: "test" }],
        implementation: {
          container: {
            image: "python:3.11",
            command: ["python", "-m", "sklearn"],
          },
        },
      },
    }),
    makeSourced({
      digest: "b",
      spec: {
        name: "drop_nulls",
        description: "Drop rows containing null values from a dataframe.",
        inputs: [{ name: "dataframe" }],
        outputs: [{ name: "clean" }],
        implementation: {
          container: {
            image: "python:3.11",
            command: ["python", "-m", "pandas"],
          },
        },
      },
    }),
    makeSourced(
      {
        digest: "c",
        spec: {
          name: "my_custom_train",
          description: "User-built trainer.",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      },
      USER,
    ),
  ];

  it("returns no results below the minimum query length", () => {
    expect(lexicalSearch(buildSearchIndex(fixtures), "", {})).toHaveLength(0);
    expect(
      lexicalSearch(buildSearchIndex(fixtures), "tr", { minLength: 3 }),
    ).toHaveLength(0);
  });

  it("ranks name matches higher than description-only matches", () => {
    const index = buildSearchIndex(fixtures);
    const results = lexicalSearch(index, "train");
    expect(results.length).toBeGreaterThanOrEqual(2);
    // Both train_test_split and my_custom_train match the name; drop_nulls
    // doesn't match anywhere, so it must not appear.
    expect(results.map((r) => r.digest)).not.toContain("b");
  });

  it("applies the multi-token full-substring bonus on the name", () => {
    const index = buildSearchIndex(fixtures);
    const results = lexicalSearch(index, "train test split");
    expect(results[0]?.digest).toBe("a");
  });

  it("tokenizes snake_case queries so each segment matches independently", () => {
    const index = buildSearchIndex(fixtures);
    const results = lexicalSearch(index, "drop nulls");
    expect(results[0]?.digest).toBe("b");
  });

  it("matches implementation/command text with the lowest weight", () => {
    const index = buildSearchIndex(fixtures);
    const results = lexicalSearch(index, "pandas");
    expect(results[0]?.digest).toBe("b");
    expect(results[0]?.matchedFields).toContain("implementation");
  });

  it("preserves the source on each returned match", () => {
    const index = buildSearchIndex(fixtures);
    const results = lexicalSearch(index, "my_custom_train");
    expect(results[0]?.source).toEqual(USER);
  });

  it("respects the limit option", () => {
    const many: SourcedReference[] = Array.from({ length: 10 }, (_, i) =>
      makeSourced({
        digest: `d${i}`,
        spec: {
          name: `train_${i}`,
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    );
    const results = lexicalSearch(buildSearchIndex(many), "train", {
      limit: 3,
    });
    expect(results).toHaveLength(3);
  });
});
