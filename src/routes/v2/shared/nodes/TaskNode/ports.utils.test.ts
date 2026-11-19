import { describe, expect, test } from "vitest";

import { condensePorts } from "./ports.utils";

const ports = [{ name: "a" }, { name: "b" }, { name: "c" }];

describe("condensePorts", () => {
  test("keeps only connected ports", () => {
    expect(condensePorts(ports, new Set(["a", "c"]))).toEqual([
      { name: "a" },
      { name: "c" },
    ]);
  });

  test("falls back to the first port when none are connected", () => {
    expect(condensePorts(ports, new Set())).toEqual([{ name: "a" }]);
  });

  test("ignores connections to ports the component no longer has", () => {
    expect(condensePorts(ports, new Set(["removed"]))).toEqual([{ name: "a" }]);
  });

  test("returns nothing for a component without ports", () => {
    expect(condensePorts([], new Set(["a"]))).toEqual([]);
  });
});
