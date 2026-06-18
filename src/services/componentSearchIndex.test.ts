import { describe, expect, it } from "vitest";

import type { ComponentReference } from "@/utils/componentSpec";

import {
  buildSearchIndex,
  type ComponentSearchSource,
  lexicalSearch,
  type SourcedReference,
} from "./componentSearchIndex";

const STANDARD: ComponentSearchSource = {
  kind: "standard",
  label: "Standard",
  id: "standard",
};
const USER: ComponentSearchSource = { kind: "user", label: "User", id: "user" };

function makeRef(
  partial: Partial<ComponentReference> & { digest?: string },
): ComponentReference {
  return {
    digest: partial.digest,
    url: partial.url,
    name: partial.name,
    published_by: partial.published_by,
    spec: partial.spec,
  };
}

function makeSourced(
  partial: Partial<ComponentReference> & { digest?: string },
  source: ComponentSearchSource = STANDARD,
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

  it("indexes name, description, io details, metadata, and container command text", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "a",
        published_by: "publisher@example.com",
        spec: {
          name: "train_model",
          description: "Train a regression model on a dataset.",
          inputs: [
            {
              name: "dataset",
              type: "Dataset",
              description: "Training table with labeled rows.",
              annotations: { format: "parquet" },
            },
          ],
          outputs: [
            {
              name: "model",
              type: { artifact: "Model" },
              description: "Serialized classifier artifact.",
            },
          ],
          implementation: {
            container: {
              image: "python:3.11",
              command: ["python", "-m", "pandas.train"],
              args: ["--epochs", "10"],
            },
          },
          metadata: {
            annotations: {
              framework: "sklearn",
              python_original_code: "do not index this large source blob",
            },
          },
        },
      }),
    ]);
    expect(index).toHaveLength(1);
    expect(index[0].searchable.name).toContain("train_model");
    expect(index[0].searchable.description).toContain("regression");
    expect(index[0].searchable.io).toContain("dataset");
    expect(index[0].searchable.io).toContain("training table");
    expect(index[0].searchable.io).toContain("parquet");
    expect(index[0].searchable.io).toContain("model");
    expect(index[0].searchable.io).toContain("serialized classifier");
    expect(index[0].searchable.io).toContain("artifact");
    expect(index[0].searchable.metadata).toContain("sklearn");
    expect(index[0].searchable.metadata).not.toContain("publisher@example.com");
    expect(index[0].searchable.metadata).not.toContain("source blob");
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
    // Two candidates that match the same three tokens on the name (3*5 = 15
    // per-token score either way), one scattered and one contiguous. Without
    // the +10 contiguous-substring bonus, the scattered name wins on the
    // alphabetical tiebreak ("a_..." < "train..."). With the bonus, the
    // contiguous snake_case name pulls ahead — this is the case the bonus
    // exists for.
    const localFixtures: SourcedReference[] = [
      makeSourced({
        digest: "scattered",
        spec: {
          name: "a_train_b_test_c_split_d",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
      makeSourced({
        digest: "contiguous",
        spec: {
          name: "train_test_split",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ];
    const index = buildSearchIndex(localFixtures);
    const results = lexicalSearch(index, "train test split");
    expect(results[0]?.digest).toBe("contiguous");
  });

  it("normalizes snake_case, kebab-case, and camelCase text", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "snake",
        spec: {
          name: "drop_nulls",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
      makeSourced({
        digest: "kebab",
        spec: {
          name: "train-model",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
      makeSourced({
        digest: "camel",
        spec: {
          name: "loadCSVFile",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    expect(lexicalSearch(index, "drop nulls")[0]?.digest).toBe("snake");
    expect(lexicalSearch(index, "train model")[0]?.digest).toBe("kebab");
    expect(lexicalSearch(index, "load csv file")[0]?.digest).toBe("camel");
  });

  it("normalizes plurals and simple stemmed terms", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "normalize",
        spec: {
          name: "train_model",
          description: "Train models on a dataset with labeled batches.",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    expect(lexicalSearch(index, "training")[0]?.digest).toBe("normalize");
    expect(lexicalSearch(index, "datasets")[0]?.digest).toBe("normalize");
    expect(lexicalSearch(index, "batch")[0]?.digest).toBe("normalize");
  });

  it("scores surface tokens and stems as one concept", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "inflected-only",
        spec: {
          name: "training_metadata",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
      makeSourced({
        digest: "stronger-concept-match",
        spec: {
          name: "train_model",
          description: "Training classifier.",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    const results = lexicalSearch(index, "training");
    expect(results[0]?.digest).toBe("stronger-concept-match");
  });

  it("ignores natural-language filler words that would otherwise swamp intent", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "target",
        spec: {
          name: "upload_to_storage",
          description: "Upload data to cloud storage.",
          inputs: [{ name: "dataset" }],
          outputs: [{ name: "uri" }],
          implementation: { container: { image: "x" } },
        },
      }),
      makeSourced({
        digest: "noise",
        spec: {
          name: "train_component",
          description: "A component to train a model.",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    const results = lexicalSearch(index, "I want to upload a component to GCS");
    expect(results.map((result) => result.digest)).toEqual(["target"]);
  });

  it("does not special-case single-letter non-stop-word tokens", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "x",
        spec: {
          name: "x_transform",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    const results = lexicalSearch(index, "x");
    expect(results[0]?.digest).toBe("x");
  });

  it("matches input/output descriptions and types", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "typed-io",
        spec: {
          name: "generic_processor",
          inputs: [
            {
              name: "data",
              type: "Dataset",
              description: "Tabular dataframe rows to clean.",
            },
          ],
          outputs: [
            {
              name: "result",
              type: { artifact: "Model" },
              description: "Trained classifier artifact.",
            },
          ],
          implementation: { container: { image: "x" } },
        },
      }),
    ]);

    expect(lexicalSearch(index, "dataframe")[0]?.digest).toBe("typed-io");
    const typeResults = lexicalSearch(index, "artifact");
    expect(typeResults[0]?.digest).toBe("typed-io");
    expect(typeResults[0]?.matchedFields).toContain("io");
  });

  it("matches component metadata without treating source labels or author emails as free text", () => {
    const index = buildSearchIndex([
      makeSourced(
        {
          digest: "meta",
          published_by: "publisher@example.com",
          spec: {
            name: "generic_processor",
            inputs: [],
            outputs: [],
            implementation: { container: { image: "x" } },
            metadata: { annotations: { framework: "lightgbm" } },
          },
        },
        USER,
      ),
    ]);

    expect(lexicalSearch(index, "lightgbm")[0]?.matchedFields).toContain(
      "metadata",
    );
    expect(lexicalSearch(index, "publisher@example")).toHaveLength(0);
    expect(lexicalSearch(index, "user")).toHaveLength(0);
  });

  it("matches dependency annotations after filtering noisy annotation keys", () => {
    const index = buildSearchIndex([
      makeSourced({
        digest: "deps",
        spec: {
          name: "dependency_component",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
          metadata: {
            annotations: {
              python_dependencies: ["tensorflow", "lightgbm"],
              python_original_code: "import noisy_private_blob",
            },
          },
        },
      }),
    ]);

    expect(lexicalSearch(index, "tensorflow")[0]?.digest).toBe("deps");
    expect(lexicalSearch(index, "noisy_private_blob")).toHaveLength(0);
  });

  it("caps aggregate annotation text indexed per component", () => {
    const annotations = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [
        `annotation_${index}`,
        `${index}`.padEnd(200, "x"),
      ]),
    );
    const index = buildSearchIndex([
      makeSourced({
        digest: "capped",
        spec: {
          name: "capped_component",
          inputs: [],
          outputs: [],
          implementation: { container: { image: "x" } },
          metadata: { annotations },
        },
      }),
    ]);

    expect(index[0].searchable.metadata.length).toBeLessThanOrEqual(2_000);
    expect(index[0].searchable.metadata).toContain("annotation_0");
    expect(index[0].searchable.metadata).not.toContain("annotation_19");
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
