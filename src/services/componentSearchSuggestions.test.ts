import { describe, expect, it } from "vitest";

import type { IndexEntry } from "@/services/componentSearchIndex";

import { buildComponentSearchSuggestions } from "./componentSearchSuggestions";

function createEntry({
  digest,
  name,
  sourceLabel = "Standard",
  sourceKind = "standard",
  inputType,
  outputType,
}: {
  digest: string;
  name: string;
  sourceLabel?: string;
  sourceKind?: IndexEntry["source"]["kind"];
  inputType?: string;
  outputType?: string;
}): IndexEntry {
  return {
    digest,
    name,
    source: { kind: sourceKind, id: sourceLabel, label: sourceLabel },
    reference: {
      digest,
      name,
      spec: {
        name,
        description: "",
        inputs: inputType ? [{ name: "input", type: inputType }] : [],
        outputs: outputType ? [{ name: "output", type: outputType }] : [],
        implementation: { container: { image: "python:3.11" } },
      },
    },
    searchable: {
      name,
      description: "",
      io: "",
      implementation: "",
      metadata: "",
    },
  };
}

describe("buildComponentSearchSuggestions", () => {
  it("prioritizes common input and output types over fallback suggestions", () => {
    const suggestions = buildComponentSearchSuggestions([
      createEntry({ digest: "1", name: "Load CSV", outputType: "Dataset" }),
      createEntry({ digest: "2", name: "Train Model", inputType: "Dataset" }),
      createEntry({ digest: "3", name: "Evaluate Model", inputType: "Model" }),
    ]);

    expect(suggestions).toEqual([
      { label: "dataset", kind: "type" },
      { label: "model", kind: "type" },
      { label: "csv", kind: "name" },
      { label: "train", kind: "name" },
    ]);
  });

  it("uses safe registered library labels when available", () => {
    const suggestions = buildComponentSearchSuggestions([
      createEntry({
        digest: "1",
        name: "Normalize Data",
        sourceKind: "registered",
        sourceLabel: "Data Tools",
      }),
    ]);

    expect(suggestions).toContainEqual({ label: "data tools", kind: "source" });
  });

  it("can omit source suggestions for surfaces that do not search collections", () => {
    const suggestions = buildComponentSearchSuggestions(
      [
        createEntry({
          digest: "1",
          name: "Normalize Data",
          sourceKind: "registered",
          sourceLabel: "Data Tools",
        }),
      ],
      { includeSources: false },
    );

    expect(suggestions).not.toContainEqual({
      label: "data tools",
      kind: "source",
    });
  });

  it("falls back to curated suggestions and excludes terms already in the query", () => {
    expect(buildComponentSearchSuggestions([], { query: "csv" })).toEqual([
      { label: "train", kind: "default" },
      { label: "predict", kind: "default" },
      { label: "dataframe", kind: "default" },
    ]);
  });
});
