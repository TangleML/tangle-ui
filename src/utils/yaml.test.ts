import { describe, expect, it } from "vitest";

import type { ComponentSpec } from "./componentSpec";
import {
  componentSpecFromYaml,
  componentSpecToText,
  componentSpecToYaml,
} from "./yaml";

const minimalSpec: ComponentSpec = {
  name: "Test Component",
  implementation: {
    container: {
      image: "python:3.11",
    },
  },
};

describe("yaml", () => {
  describe("componentSpecToYaml / componentSpecFromYaml", () => {
    it("round-trips a component spec through YAML", () => {
      const yamlText = componentSpecToYaml(minimalSpec);

      expect(typeof yamlText).toBe("string");
      expect(componentSpecFromYaml(yamlText)).toEqual(minimalSpec);
    });
  });

  describe("componentSpecFromYaml", () => {
    it("throws when the YAML is not an object", () => {
      expect(() => componentSpecFromYaml("just a plain string")).toThrow(
        "Invalid component specification format",
      );
    });

    it("throws when the parsed object has no implementation", () => {
      expect(() =>
        componentSpecFromYaml("name: missing implementation"),
      ).toThrow("Invalid component specification format");
    });
  });

  describe("componentSpecToText", () => {
    it("serializes with two-space indentation and without YAML anchors", () => {
      const text = componentSpecToText(minimalSpec);

      expect(text).toContain("implementation:");
      expect(text).toContain("  container:");
      expect(text).not.toContain("&");
    });
  });
});
