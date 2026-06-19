import { beforeEach, describe, expect, it, vi } from "vitest";

import { ComponentSpec } from "@/models/componentSpec/entities/componentSpec";
import { Task } from "@/models/componentSpec/entities/task";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { validateSpec } from "@/models/componentSpec/validation/validateSpec";
import { hydrateLoadedSpecRefs } from "@/routes/v2/pages/Editor/utils/hydrateSpecRefs";
import { hydrateComponentReference } from "@/services/componentService";
import type {
  ComponentSpec as ComponentSpecJson,
  HydratedComponentReference,
} from "@/utils/componentSpec";

vi.mock("@/services/componentService", () => ({
  hydrateComponentReference: vi.fn(),
}));

const mockHydrate = vi.mocked(hydrateComponentReference);

const idGen = new IncrementingIdGenerator();

function makeContainerSpec(name: string): ComponentSpecJson {
  return {
    name,
    implementation: { container: { image: "alpine" } },
  };
}

function makeHydratedRef(name: string): HydratedComponentReference {
  return {
    name,
    digest: `digest-${name}`,
    text: `name: ${name}`,
    spec: makeContainerSpec(name),
  };
}

function specWithTask(task: Task): ComponentSpec {
  return new ComponentSpec({
    $id: idGen.next("spec"),
    name: "Pipeline",
    tasks: [task],
  });
}

describe("hydrateLoadedSpecRefs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("populates resolvedComponentSpec for a text-only ref", async () => {
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: { text: "name: Foo" },
    });
    const spec = specWithTask(task);

    mockHydrate.mockResolvedValue(makeHydratedRef("Foo"));

    expect(task.resolvedComponentSpec).toBeUndefined();

    await hydrateLoadedSpecRefs(spec);

    expect(mockHydrate).toHaveBeenCalledTimes(1);
    expect(task.resolvedComponentSpec).toBeDefined();
    expect(task.resolvedComponentSpec?.name).toBe("Foo");
  });

  it("leaves the ref untouched and surfaces a validation issue on failure", async () => {
    const task = new Task({
      $id: idGen.next("task"),
      name: "Process",
      componentRef: { url: "https://example.com/comp.yaml", digest: "abc" },
    });
    const spec = specWithTask(task);

    mockHydrate.mockResolvedValue(null);

    await hydrateLoadedSpecRefs(spec);

    expect(task.componentRef.url).toBe("https://example.com/comp.yaml");
    expect(task.resolvedComponentSpec).toBeUndefined();

    const issues = validateSpec(spec);
    expect(
      issues.some(
        (issue) =>
          issue.entityId === task.$id &&
          issue.issueCode === "COMPONENT_HYDRATION_FAILED",
      ),
    ).toBe(true);
  });

  it("recurses into subgraph tasks without re-hydrating the subgraph ref", async () => {
    const innerTask = new Task({
      $id: idGen.next("task"),
      name: "Inner",
      componentRef: { text: "name: Inner" },
    });
    const innerSpec = new ComponentSpec({
      $id: idGen.next("spec"),
      name: "Subgraph",
      tasks: [innerTask],
    });
    const subgraphTask = new Task({
      $id: idGen.next("task"),
      name: "Outer",
      componentRef: { name: "Outer" },
      subgraphSpec: innerSpec,
    });
    const spec = specWithTask(subgraphTask);

    mockHydrate.mockResolvedValue(makeHydratedRef("Inner"));

    await hydrateLoadedSpecRefs(spec);

    expect(mockHydrate).toHaveBeenCalledTimes(1);
    expect(innerTask.resolvedComponentSpec).toBeDefined();
    expect(innerTask.resolvedComponentSpec?.name).toBe("Inner");
  });
});
