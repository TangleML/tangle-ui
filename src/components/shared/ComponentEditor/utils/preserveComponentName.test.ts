import { describe, expect, it } from "vitest";

import { preserveComponentName } from "./preserveComponentName";

describe("preserveComponentName", () => {
  const baseYaml = `name: Original Name
description: Sample
implementation:
  container:
    image: python:3.12
`;

  it("returns original yaml when no name provided", () => {
    expect(preserveComponentName(baseYaml)).toBe(baseYaml);
    expect(preserveComponentName(baseYaml, "")).toBe(baseYaml);
  });

  it("replaces the name when provided", () => {
    const result = preserveComponentName(baseYaml, "Preserved Name");

    expect(result).toContain("name: Preserved Name");
  });

  it("falls back to original yaml on parse errors", () => {
    const malformedYaml = ":- invalid";

    expect(preserveComponentName(malformedYaml, "New Name")).toBe(
      malformedYaml,
    );
  });
});
