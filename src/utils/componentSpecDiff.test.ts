import { describe, expect, it } from "vitest";

import {
  computeEntityDiff,
  diffComponentIO,
  hasIODiff,
} from "./componentSpecDiff";

describe("computeEntityDiff", () => {
  const eq = (
    a: { name: string; type?: string },
    b: { name: string; type?: string },
  ) => a.type === b.type;

  it("classifies lost, new, and changed entities", () => {
    const prev = [
      { name: "a", type: "String" },
      { name: "b", type: "String" },
      { name: "c", type: "Integer" },
    ];
    const curr = [
      { name: "a", type: "String" }, // unchanged
      { name: "b", type: "Integer" }, // changed (type)
      { name: "d", type: "String" }, // new
    ];

    const diff = computeEntityDiff(prev, curr, eq);

    expect(diff.lostEntities.map((e) => e.name)).toEqual(["c"]);
    expect(diff.newEntities.map((e) => e.name)).toEqual(["d"]);
    expect(diff.changedEntities.map((e) => e.name)).toEqual(["b"]);
  });

  it("returns an empty diff when either side is undefined", () => {
    expect(computeEntityDiff(undefined, [{ name: "a" }], eq)).toEqual({
      lostEntities: [],
      newEntities: [],
      changedEntities: [],
    });
    expect(computeEntityDiff([{ name: "a" }], undefined, eq)).toEqual({
      lostEntities: [],
      newEntities: [],
      changedEntities: [],
    });
  });

  it("preserves input order", () => {
    const prev = [{ name: "x" }, { name: "y" }, { name: "z" }];
    const curr = [{ name: "z" }, { name: "x" }];
    const diff = computeEntityDiff(prev, curr, () => true);
    expect(diff.lostEntities.map((e) => e.name)).toEqual(["y"]);
  });
});

describe("diffComponentIO", () => {
  it("diffs inputs and outputs by name and type", () => {
    const oldSpec = {
      inputs: [
        { name: "Limit", type: "Integer" },
        { name: "Select", type: "String" },
      ],
      outputs: [{ name: "Table" }],
    };
    const newSpec = {
      inputs: [
        { name: "Limit", type: "Integer" },
        { name: "Format", type: "String" },
      ],
      outputs: [{ name: "Table" }, { name: "Schema" }],
    };

    const { inputDiff, outputDiff } = diffComponentIO(oldSpec, newSpec);

    expect(inputDiff.lostEntities.map((e) => e.name)).toEqual(["Select"]);
    expect(inputDiff.newEntities.map((e) => e.name)).toEqual(["Format"]);
    expect(outputDiff.newEntities.map((e) => e.name)).toEqual(["Schema"]);
  });
});

describe("hasIODiff", () => {
  const empty = { lostEntities: [], newEntities: [], changedEntities: [] };

  it("is false when both diffs are empty", () => {
    expect(hasIODiff(empty, empty)).toBe(false);
  });

  it("is true when the input diff has any change", () => {
    expect(hasIODiff({ ...empty, newEntities: [{ name: "x" }] }, empty)).toBe(
      true,
    );
  });

  it("is true when the output diff has any change", () => {
    expect(hasIODiff(empty, { ...empty, lostEntities: [{ name: "y" }] })).toBe(
      true,
    );
  });
});
