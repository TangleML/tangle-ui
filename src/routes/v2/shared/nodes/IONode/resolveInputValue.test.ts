import { describe, expect, it } from "vitest";

import { Input } from "@/models/componentSpec/entities/input";

import { resolveInputValue } from "./resolveInputValue";

function createInput() {
  return new Input({
    $id: "input-template-params",
    name: "template_params",
    value: "configured value",
    defaultValue: "default value",
  });
}

describe("resolveInputValue", () => {
  it("prefers the run argument over the configured and default values", () => {
    const input = createInput();

    expect(resolveInputValue(input, { template_params: "run value" })).toBe(
      "run value",
    );
  });

  it("preserves an empty run argument instead of showing the default", () => {
    const input = createInput();

    expect(resolveInputValue(input, { template_params: "" })).toBe("");
  });

  it("falls back to the configured value and then the default", () => {
    const input = createInput();

    expect(resolveInputValue(input)).toBe("configured value");

    input.setValue(undefined);
    expect(resolveInputValue(input)).toBe("default value");
  });
});
