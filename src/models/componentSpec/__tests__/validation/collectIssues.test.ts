import { describe, expect, it } from "vitest";

import { ComponentSpec } from "../../entities/componentSpec";
import { Task } from "../../entities/task";
import type { ComponentSpecJson } from "../../entities/types";
import { isGraphImplementation } from "../../entities/types";
import { IncrementingIdGenerator } from "../../factories/idGenerator";
import { YamlDeserializer } from "../../serialization/yamlDeserializer";
import { collectValidationIssues } from "../../validation/collectIssues";

function makeSpec(name = "TestPipeline"): ComponentSpec {
  return new ComponentSpec({ $id: "spec_1", name });
}

function makeTask(id: string, name: string, spec?: ComponentSpecJson): Task {
  if (spec && isGraphImplementation(spec.implementation)) {
    const idGen = new IncrementingIdGenerator();
    const deserializer = new YamlDeserializer(idGen);
    const subgraphSpec = deserializer.deserialize(spec);
    return new Task({
      $id: id,
      name,
      componentRef: { name: `component-${name}` },
      subgraphSpec,
    });
  }
  return new Task({
    $id: id,
    name,
    componentRef: { name: `component-${name}`, spec },
  });
}

describe("collectValidationIssues", () => {
  it("returns issues for root spec with subgraphPath ['root']", () => {
    const spec = makeSpec("");

    const issues = collectValidationIssues(spec);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].subgraphPath).toEqual(["root"]);
  });

  it("returns issues with stable IDs", () => {
    const spec = makeSpec("");

    const issues = collectValidationIssues(spec);

    expect(issues[0].id).toMatch(/^root::/);
  });

  it("collects issues from nested subgraph specs", () => {
    const nestedSpec: ComponentSpecJson = {
      name: "",
      implementation: {
        graph: {
          tasks: {
            InnerTask: {
              componentRef: { name: "inner-component" },
            },
          },
        },
      },
    };

    const spec = makeSpec("Root");
    const subgraphTask = makeTask("t1", "SubgraphTask", nestedSpec);
    spec.addTask(subgraphTask);

    const issues = collectValidationIssues(spec);

    const nestedIssues = issues.filter(
      (i) => i.subgraphPath.length > 1 && i.subgraphPath[1] === "SubgraphTask",
    );

    expect(nestedIssues.length).toBeGreaterThan(0);
    expect(nestedIssues[0].subgraphPath).toEqual(["root", "SubgraphTask"]);
  });

  it("does not recurse into non-graph implementations", () => {
    const containerSpec: ComponentSpecJson = {
      name: "Container",
      implementation: {
        container: { image: "my-image:latest" },
      },
    };

    const spec = makeSpec("Root");
    spec.addTask(makeTask("t1", "ContainerTask", containerSpec));

    const issues = collectValidationIssues(spec);
    const nestedIssues = issues.filter((i) => i.subgraphPath.length > 1);

    expect(nestedIssues).toHaveLength(0);
  });

  it("returns empty array for valid spec with no nested issues", () => {
    const spec = makeSpec("ValidPipeline");
    spec.addTask(
      makeTask("t1", "TaskA", {
        name: "SomeComponent",
        implementation: { container: { image: "test" } },
      }),
    );

    const issues = collectValidationIssues(spec);

    expect(issues).toHaveLength(0);
  });
});
