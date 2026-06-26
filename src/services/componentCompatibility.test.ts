import { describe, expect, it } from "vitest";

import type { ComponentReference, TypeSpecType } from "@/utils/componentSpec";

import { buildCompatibleComponentSuggestions } from "./componentCompatibility";

function component({
  digest,
  inputs = [],
  outputs = [],
}: {
  digest: string;
  inputs?: Array<{ name: string; type?: TypeSpecType }>;
  outputs?: Array<{ name: string; type?: TypeSpecType }>;
}): ComponentReference {
  return {
    digest,
    name: digest,
    spec: {
      name: digest,
      inputs,
      outputs,
      implementation: { container: { image: "python:3.11" } },
    },
  };
}

describe("buildCompatibleComponentSuggestions", () => {
  it("finds downstream components whose inputs match selected outputs", () => {
    const selected = component({
      digest: "load-data",
      outputs: [{ name: "dataset", type: "Dataset" }],
    });
    const downstream = component({
      digest: "train-model",
      inputs: [{ name: "dataset", type: "dataset" }],
    });

    expect(buildCompatibleComponentSuggestions(selected, [downstream])).toEqual(
      [
        {
          direction: "downstream",
          reference: downstream,
          matchedTypes: ["dataset"],
        },
      ],
    );
  });

  it("finds upstream components whose outputs match selected inputs", () => {
    const selected = component({
      digest: "train-model",
      inputs: [{ name: "dataset", type: "Dataset" }],
    });
    const upstream = component({
      digest: "load-data",
      outputs: [{ name: "dataset", type: "dataset" }],
    });

    expect(buildCompatibleComponentSuggestions(selected, [upstream])).toEqual([
      {
        direction: "upstream",
        reference: upstream,
        matchedTypes: ["dataset"],
      },
    ]);
  });

  it("matches object types regardless of key order", () => {
    const selected = component({
      digest: "load-data",
      outputs: [
        {
          name: "dataset",
          type: { schema: "Dataset", format: "parquet" },
        },
      ],
    });
    const downstream = component({
      digest: "train-model",
      inputs: [
        {
          name: "dataset",
          type: { format: "parquet", schema: "Dataset" },
        },
      ],
    });

    expect(buildCompatibleComponentSuggestions(selected, [downstream])).toEqual(
      [
        {
          direction: "downstream",
          reference: downstream,
          matchedTypes: ['{"format":"parquet","schema":"dataset"}'],
        },
      ],
    );
  });

  it("ignores self, any, missing specs, and unmatched types", () => {
    const selected = component({
      digest: "selected",
      inputs: [{ name: "input", type: "Any" }],
      outputs: [{ name: "output", type: "Dataset" }],
    });

    expect(
      buildCompatibleComponentSuggestions(selected, [
        selected,
        { digest: "stub" },
        component({
          digest: "metrics",
          inputs: [{ name: "metrics", type: "Metrics" }],
        }),
      ]),
    ).toEqual([]);
  });
});
