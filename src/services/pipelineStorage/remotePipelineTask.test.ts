import { describe, expect, it } from "vitest";

import type { ComponentSpec } from "@/utils/componentSpec";

import {
  editorSpecFromRemoteTask,
  remotePipelineTaskFromSpec,
} from "./remotePipelineTask";

const spec: ComponentSpec = {
  name: "Hello World",
  inputs: [
    { name: "name", type: "String", value: "", optional: false },
    { name: "prefix", default: "Hello", value: "Welcome" },
    { name: "suffix", default: "!", optional: true },
  ],
  implementation: { graph: { tasks: {} } },
};

describe("remote pipeline task conversion", () => {
  it("normalizes root and nested annotations without changing the editor spec", () => {
    const annotations = {
      revision: 3,
      enabled: false,
      tags: ["example"],
      details: { count: 2 },
      text: "unchanged",
      empty: null,
      missing: undefined,
    };
    const input: ComponentSpec = {
      metadata: { annotations },
      implementation: {
        graph: {
          tasks: {
            Nested: {
              componentRef: {
                spec: {
                  metadata: { annotations },
                  implementation: { container: { image: "example:latest" } },
                },
              },
            },
          },
        },
      },
    };
    const original = structuredClone(input);

    const saved = remotePipelineTaskFromSpec(input).componentRef.spec;
    const expected = {
      revision: "3",
      enabled: "false",
      tags: '["example"]',
      details: '{"count":2}',
      text: "unchanged",
    };
    expect(saved.metadata?.annotations).toEqual(expected);
    if (!("graph" in saved.implementation)) throw new Error("Expected graph");
    expect(
      saved.implementation.graph.tasks.Nested.componentRef.spec?.metadata
        ?.annotations,
    ).toEqual(expected);
    expect(input).toEqual(original);
  });

  it("stores configured values as task arguments and restores them for the editor", () => {
    const original = structuredClone(spec);
    const task = remotePipelineTaskFromSpec(spec);

    expect(task.arguments).toEqual({ name: "", prefix: "Welcome" });
    expect(task.componentRef.spec.inputs).toEqual([
      { name: "name", type: "String", optional: false },
      { name: "prefix", default: "Hello" },
      { name: "suffix", default: "!", optional: true },
    ]);
    expect(editorSpecFromRemoteTask(task)).toEqual(spec);
    expect(spec).toEqual(original);
    expect(task.componentRef.spec.inputs?.[0]).not.toHaveProperty("value");
  });

  it("updates or clears editor values while preserving other root task settings", () => {
    const secret = { dynamicData: { secret: { name: "token" } } };
    const previous = {
      componentRef: { digest: "old-digest", spec },
      arguments: { name: "Old name", token: secret },
      annotations: { note: "Keep me" },
      executionOptions: { cachingStrategy: { maxCacheStaleness: "P1D" } },
    };
    const updated = remotePipelineTaskFromSpec(
      { ...spec, inputs: [{ name: "name", value: "Ada" }, { name: "token" }] },
      previous,
    );
    expect(updated.arguments).toEqual({ name: "Ada", token: secret });
    expect(updated.annotations).toEqual(previous.annotations);
    expect(updated.executionOptions).toEqual(previous.executionOptions);
    expect(updated.componentRef).not.toHaveProperty("digest");

    const cleared = remotePipelineTaskFromSpec(
      { ...spec, inputs: [{ name: "name" }, { name: "token" }] },
      updated,
    );
    expect(cleared.arguments).toEqual({ token: secret });
    expect(editorSpecFromRemoteTask(cleared).inputs).toEqual([
      { name: "name" },
      { name: "token" },
    ]);
    expect(previous.arguments.name).toBe("Old name");
  });

  it.each([undefined, "renamed"])(
    "removes the old argument when an input is deleted or renamed to %s",
    (newName) => {
      const previous = remotePipelineTaskFromSpec(spec);
      const loaded = editorSpecFromRemoteTask(previous);
      const edited = {
        ...loaded,
        inputs: loaded.inputs?.flatMap((input) => {
          if (input.name !== "name") return [input];
          return newName ? [{ ...input, name: newName }] : [];
        }),
      };

      const saved = remotePipelineTaskFromSpec(edited, previous);

      expect(saved.arguments).toEqual({
        ...(newName && { [newName]: "" }),
        prefix: "Welcome",
      });
      expect(editorSpecFromRemoteTask(saved)).toEqual(edited);
      expect(previous.arguments).toEqual({ name: "", prefix: "Welcome" });
    },
  );

  it.each([true, false])(
    "removes library metadata from nested references (embedded spec: %s)",
    (embedded) => {
      const libraryMetadata = {
        favorited: true,
        owned: true,
        published_by: "author@example.com",
        deprecated: false,
        superseded_by: "new-digest",
        id: "library-record-id",
        data: "name: Component",
        createdAt: 100,
        updatedAt: 200,
      };
      const reference = {
        name: "Component",
        digest: "component-digest",
        tag: "v1",
        url: "https://example.com/component.yaml",
        text: "implementation:\n  container:\n    image: example:latest\n",
        ...(embedded && {
          spec: { implementation: { container: { image: "example:latest" } } },
        }),
      };
      const child = {
        componentRef: { ...reference, ...libraryMetadata },
        arguments: { input: "Keep this value" },
        annotations: { "editor.position": '{"x":10,"y":20}' },
      };
      const subgraph = {
        implementation: { graph: { tasks: { Child: child } } },
      };
      const editorSpec: ComponentSpec = {
        implementation: {
          graph: {
            tasks: {
              Subgraph: {
                componentRef: {
                  name: "Subgraph",
                  spec: subgraph,
                  ...libraryMetadata,
                },
              },
            },
          },
        },
      };
      const original = structuredClone(editorSpec);

      const task = remotePipelineTaskFromSpec(editorSpec);

      expect(task.componentRef.spec).toStrictEqual({
        implementation: {
          graph: {
            tasks: {
              Subgraph: {
                componentRef: {
                  name: "Subgraph",
                  spec: {
                    implementation: {
                      graph: {
                        tasks: { Child: { ...child, componentRef: reference } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      expect(editorSpec).toStrictEqual(original);
    },
  );

  it("normalizes nested components without replacing their explicit argument bindings", () => {
    const nested: ComponentSpec = {
      ...spec,
      implementation: {
        graph: {
          tasks: {
            Subgraph: {
              annotations: { "editor.position": '{"x":10,"y":20}' },
              componentRef: {
                spec: {
                  inputs: [{ name: "name", value: "Nested value" }],
                  implementation: {
                    graph: {
                      tasks: {
                        Greet: {
                          componentRef: {
                            spec: {
                              ...spec,
                              implementation: {
                                container: { image: "example:latest" },
                              },
                            },
                          },
                          arguments: {
                            name: { graphInput: { inputName: "name" } },
                          },
                        },
                        External: {
                          componentRef: {
                            url: "https://example.com/component.yaml",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };
    const original = structuredClone(nested);
    const task = remotePipelineTaskFromSpec(nested);
    const implementation = task.componentRef.spec.implementation;
    if (!("graph" in implementation)) throw new Error("Expected graph");
    const subgraph = implementation.graph.tasks.Subgraph;
    expect(subgraph.arguments).toEqual({ name: "Nested value" });
    expect(subgraph.componentRef.spec?.inputs).toEqual([{ name: "name" }]);
    const child = subgraph.componentRef.spec?.implementation;
    if (!child || !("graph" in child)) throw new Error("Expected subgraph");
    expect(child.graph.tasks.Greet.arguments).toEqual({
      name: { graphInput: { inputName: "name" } },
      prefix: "Welcome",
    });
    expect(
      child.graph.tasks.Greet.componentRef.spec?.inputs?.every(
        (input) => !("value" in input),
      ),
    ).toBe(true);
    expect(child.graph.tasks.External).toEqual({
      componentRef: { url: "https://example.com/component.yaml" },
    });
    expect(nested).toEqual(original);
  });
});
