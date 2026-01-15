import { describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";

import { processTemplate } from "./processTemplate";
import type { TaskSpecShape } from "./types";

/**
 * Creates a minimal ComponentSpec for testing.
 */
const createMinimalComponentSpec = (
  overrides: Partial<ComponentSpec> = {},
): ComponentSpec => ({
  name: "test-component",
  implementation: {
    container: { image: "test-image", command: ["echo"] },
  },
  ...overrides,
});

/**
 * Creates a minimal TaskSpecShape for testing.
 */
const createTaskSpecShape = (
  overrides: Partial<{
    componentSpec: Partial<ComponentSpec>;
    arguments: Record<string, string>;
    annotations: Record<string, unknown>;
  }> = {},
): TaskSpecShape => ({
  componentRef: {
    spec: createMinimalComponentSpec(overrides.componentSpec),
  },
  arguments: overrides.arguments ?? null,
  annotations: overrides.annotations ?? null,
});

describe("processTemplate", () => {
  describe("basic template handling", () => {
    it("returns empty string when template is empty", () => {
      const taskSpec = createTaskSpecShape();

      const result = processTemplate("", taskSpec);

      expect(result).toBe("");
    });

    it("returns template unchanged when no placeholders exist", () => {
      const taskSpec = createTaskSpecShape();
      const template = "Simple text without placeholders";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Simple text without placeholders");
    });

    it("preserves special characters in template", () => {
      const taskSpec = createTaskSpecShape();
      const template = "Text with special chars: !@#%^&*()[]{}|\\;':\",./<>?";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe(template);
    });
  });

  describe("arguments source", () => {
    it("resolves placeholder from taskSpec.arguments", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { "Dataset Path": "/data/training" },
      });
      const template = "Training on ${arguments.Dataset Path}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Training on /data/training");
    });

    it("falls back to componentSpec input value when argument not in taskSpec", () => {
      const taskSpec = createTaskSpecShape({
        componentSpec: {
          inputs: [{ name: "Dataset Path", value: "/default/data" }],
        },
      });
      const template = "Training on ${arguments.Dataset Path}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Training on /default/data");
    });

    it("falls back to componentSpec input default when no value set", () => {
      const taskSpec = createTaskSpecShape({
        componentSpec: {
          inputs: [{ name: "Learning Rate", default: "0.001" }],
        },
      });
      const template = "LR: ${arguments.Learning Rate}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("LR: 0.001");
    });

    it("prioritizes taskSpec.arguments over componentSpec input value", () => {
      const taskSpec = createTaskSpecShape({
        componentSpec: {
          inputs: [{ name: "Epochs", value: "50", default: "10" }],
        },
        arguments: { Epochs: "100" },
      });
      const template = "Training for ${arguments.Epochs} epochs";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Training for 100 epochs");
    });

    it("leaves placeholder unchanged when argument not found anywhere", () => {
      const taskSpec = createTaskSpecShape();
      const template = "Missing: ${arguments.Unknown Argument}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Missing: ${arguments.Unknown Argument}");
    });

    it("handles arguments with special characters in names", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { "input-with-dashes_and_underscores": "value123" },
      });
      const template = "Value: ${arguments.input-with-dashes_and_underscores}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Value: value123");
    });
  });

  describe("annotations source", () => {
    it("resolves string annotation value", () => {
      const taskSpec = createTaskSpecShape({
        annotations: { environment: "production" },
      });
      const template = "Environment: ${annotations.environment}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Environment: production");
    });

    it("converts number annotation to string", () => {
      const taskSpec = createTaskSpecShape({
        annotations: { version: 42 },
      });
      const template = "Version: ${annotations.version}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Version: 42");
    });

    it("converts boolean annotation to string", () => {
      const taskSpec = createTaskSpecShape({
        annotations: { debug: true },
      });
      const template = "Debug: ${annotations.debug}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Debug: true");
    });

    it("leaves placeholder unchanged when annotation not found", () => {
      const taskSpec = createTaskSpecShape({
        annotations: { existing: "value" },
      });
      const template = "Missing: ${annotations.nonexistent}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Missing: ${annotations.nonexistent}");
    });

    it("leaves placeholder unchanged when annotations is null", () => {
      const taskSpec = createTaskSpecShape({ annotations: {} });
      taskSpec.annotations = null;
      const template = "Annotation: ${annotations.key}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Annotation: ${annotations.key}");
    });
  });

  describe("date source", () => {
    it("resolves timestamp format to Unix timestamp in seconds", () => {
      vi.useFakeTimers();
      const testDate = new Date("2026-01-21T15:30:45.000Z");
      vi.setSystemTime(testDate);

      const taskSpec = createTaskSpecShape();
      const template = "Run at ${date.timestamp}";

      const result = processTemplate(template, taskSpec);

      const expectedTimestamp = Math.floor(
        testDate.getTime() / 1000,
      ).toString();
      expect(result).toBe(`Run at ${expectedTimestamp}`);

      vi.useRealTimers();
    });

    it("resolves short date format", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-21T15:30:45.000Z"));

      const taskSpec = createTaskSpecShape();
      const template = "Created: ${date.short}";

      const result = processTemplate(template, taskSpec);

      // Short format varies by locale, so we just check it's not the placeholder
      expect(result).not.toBe("Created: ${date.short}");
      expect(result).toMatch(/Created: .+/);

      vi.useRealTimers();
    });

    it("resolves long date format", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-21T15:30:45.000Z"));

      const taskSpec = createTaskSpecShape();
      const template = "Created: ${date.long}";

      const result = processTemplate(template, taskSpec);

      // Long format varies by locale, so we just check it's not the placeholder
      expect(result).not.toBe("Created: ${date.long}");
      expect(result).toMatch(/Created: .+/);

      vi.useRealTimers();
    });

    it("leaves placeholder unchanged for unknown date format", () => {
      const taskSpec = createTaskSpecShape();
      const template = "Date: ${date.unknownFormat}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Date: ${date.unknownFormat}");
    });
  });

  describe("invalid placeholders", () => {
    it("leaves placeholder unchanged for unknown source", () => {
      const taskSpec = createTaskSpecShape();
      const template = "Value: ${unknown.key}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Value: ${unknown.key}");
    });

    it("leaves placeholder unchanged when missing dot separator", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { arguments: "value" },
      });
      const template = "Value: ${arguments}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Value: ${arguments}");
    });

    it("leaves placeholder unchanged when key is empty", () => {
      const taskSpec = createTaskSpecShape();
      const template = "Value: ${arguments.}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Value: ${arguments.}");
    });

    it("handles whitespace around placeholder content", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { key: "value" },
      });
      const template = "Value: ${ arguments.key }";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Value: value");
    });
  });

  describe("multiple placeholders", () => {
    it("resolves multiple different placeholders", () => {
      vi.useFakeTimers();
      const testDate = new Date("2026-01-21T15:30:45.000Z");
      vi.setSystemTime(testDate);

      const taskSpec = createTaskSpecShape({
        arguments: { model: "bert-large" },
        annotations: { version: "v2" },
      });
      const template =
        "${arguments.model}-${annotations.version}-${date.timestamp}";

      const result = processTemplate(template, taskSpec);

      const expectedTimestamp = Math.floor(
        testDate.getTime() / 1000,
      ).toString();
      expect(result).toBe(`bert-large-v2-${expectedTimestamp}`);

      vi.useRealTimers();
    });

    it("resolves same placeholder appearing multiple times", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { name: "experiment" },
      });
      const template =
        "${arguments.name}: Start ${arguments.name}, End ${arguments.name}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("experiment: Start experiment, End experiment");
    });

    it("handles mix of resolved and unresolved placeholders", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { found: "exists" },
      });
      const template = "${arguments.found} and ${arguments.missing}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("exists and ${arguments.missing}");
    });
  });

  describe("edge cases", () => {
    it("handles placeholder with nested braces in surrounding text", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { key: "value" },
      });
      const template = "{prefix}${arguments.key}{suffix}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("{prefix}value{suffix}");
    });

    it("handles placeholder at start of template", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { key: "value" },
      });
      const template = "${arguments.key} is at the start";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("value is at the start");
    });

    it("handles placeholder at end of template", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { key: "value" },
      });
      const template = "Ends with ${arguments.key}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Ends with value");
    });

    it("handles template that is just a placeholder", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { key: "value" },
      });
      const template = "${arguments.key}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("value");
    });

    it("handles empty argument value", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { empty: "" },
      });
      const template = "Value: [${arguments.empty}]";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Value: []");
    });

    it("handles key with dots in the name", () => {
      const taskSpec = createTaskSpecShape({
        arguments: { "config.learning.rate": "0.01" },
      });
      const template = "Rate: ${arguments.config.learning.rate}";

      const result = processTemplate(template, taskSpec);

      expect(result).toBe("Rate: 0.01");
    });
  });
});
