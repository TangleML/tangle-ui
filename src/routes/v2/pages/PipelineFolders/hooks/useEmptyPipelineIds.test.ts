import { describe, expect, it } from "vitest";

import { pipelineTextHasNoTasks } from "./useEmptyPipelineIds";

describe("pipelineTextHasNoTasks", () => {
  it("is true for a pipeline an agent created and never filled in", () => {
    expect(
      pipelineTextHasNoTasks(
        [
          "name: negative direct how tell",
          "implementation:",
          "  graph:",
          "    tasks: {}",
        ].join("\n"),
      ),
    ).toBe(true);
  });

  it("is true for a graph with no tasks key at all", () => {
    expect(
      pipelineTextHasNoTasks(
        [
          "name: roar organization thumb bound",
          "implementation:",
          "  graph: {}",
        ].join("\n"),
      ),
    ).toBe(true);
  });

  it("is false once the pipeline holds a task", () => {
    expect(
      pipelineTextHasNoTasks(
        [
          "name: Churn model",
          "implementation:",
          "  graph:",
          "    tasks:",
          "      Train:",
          "        componentRef:",
          "          name: Train",
        ].join("\n"),
      ),
    ).toBe(false);
  });

  it("is false for a container component, which holds no graph to be empty", () => {
    expect(
      pipelineTextHasNoTasks(
        [
          "name: Train",
          "implementation:",
          "  container:",
          "    image: alpine",
        ].join("\n"),
      ),
    ).toBe(false);
  });

  it("is false for yaml it cannot read, rather than hiding it", () => {
    expect(pipelineTextHasNoTasks("name: [unclosed")).toBe(false);
    expect(pipelineTextHasNoTasks("")).toBe(false);
  });

  it("answers rather than throwing for readable yaml of the wrong shape", () => {
    expect(pipelineTextHasNoTasks("implementation: oops")).toBe(false);
    expect(pipelineTextHasNoTasks("- one\n- two")).toBe(false);
    expect(pipelineTextHasNoTasks("just a string")).toBe(false);
    expect(
      pipelineTextHasNoTasks(
        ["name: Odd", "implementation:", "  graph:", "    tasks: oops"].join(
          "\n",
        ),
      ),
    ).toBe(false);
  });

  it("is true for a graph that says nothing about its tasks", () => {
    expect(
      pipelineTextHasNoTasks(
        ["name: Odd", "implementation:", "  graph:", "    tasks:"].join("\n"),
      ),
    ).toBe(true);
    expect(
      pipelineTextHasNoTasks(
        ["name: Odd", "implementation:", "  graph:"].join("\n"),
      ),
    ).toBe(true);
  });
});
