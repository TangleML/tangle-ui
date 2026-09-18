import { readFileSync } from "node:fs";

import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";
import { PIPELINE_YAML_LOAD_OPTIONS } from "@/utils/yaml";

import { pipelineValidity } from "./pipelineValidity";

function examplePipeline(file: string): ComponentSpec {
  const text = readFileSync(`public/example-pipelines/${file}`, "utf8");
  return yaml.load(text, PIPELINE_YAML_LOAD_OPTIONS) as ComponentSpec;
}

const container = {
  implementation: { container: { image: "python:3.11" } },
} as unknown as ComponentSpec;

function graph(tasks: Record<string, unknown>): ComponentSpec {
  return {
    name: "Pipeline",
    implementation: { graph: { tasks } },
  } as unknown as ComponentSpec;
}

describe("pipelineValidity", () => {
  it("passes a pipeline the app ships as an example", () => {
    expect(
      pipelineValidity(
        examplePipeline("Intro-Data Flow.pipeline.component.yaml"),
      ),
    ).toBe("valid");
  });

  it("fails the pipeline the app ships to demonstrate validation errors", () => {
    expect(
      pipelineValidity(
        examplePipeline("validation-errors-demo.pipeline.component.yaml"),
      ),
    ).toBe("invalid");
  });

  it("agrees with the editor that an empty pipeline is an error", () => {
    expect(pipelineValidity(graph({}))).toBe("invalid");
  });

  it("judges a single-container component rather than throwing", () => {
    expect(pipelineValidity(container)).toBe("invalid");
  });

  /**
   * The validator reads embedded component specs and never fetches one, so a
   * task without its component would read as a hydration error and show a
   * false "not valid".
   */
  it("withholds a verdict when a task does not carry its component", () => {
    expect(
      pipelineValidity(
        graph({
          Greet: { componentRef: { url: "https://example.test/hello.yaml" } },
        }),
      ),
    ).toBe("unknown");
  });

  it("withholds a verdict when only some tasks carry their component", () => {
    const embedded = examplePipeline("Intro-Data Flow.pipeline.component.yaml");
    const tasks = {
      ...(
        embedded.implementation as { graph: { tasks: Record<string, unknown> } }
      ).graph.tasks,
      Orphan: { componentRef: { url: "https://example.test/hello.yaml" } },
    };

    expect(pipelineValidity(graph(tasks))).toBe("unknown");
  });

  /** A pipeline read out of browser storage is whatever yaml is there. */
  it("withholds a verdict on a spec too malformed to have an implementation", () => {
    expect(pipelineValidity({ name: "Broken" } as ComponentSpec)).toBe(
      "unknown",
    );
    expect(pipelineValidity({} as ComponentSpec)).toBe("unknown");
  });

  it("stays fast enough to run while a row is being clicked", () => {
    const spec = examplePipeline(
      "validation-errors-demo.pipeline.component.yaml",
    );

    const started = performance.now();
    pipelineValidity(spec);
    const elapsed = performance.now() - started;

    expect(elapsed).toBeLessThan(100);
  });
});
