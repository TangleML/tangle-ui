import { describe, expect, it, vi } from "vitest";

import type { ComponentSpec, TaskSpec } from "./componentSpec";
import { isGraphImplementation } from "./componentSpec";
import {
  getSubgraphComponentSpec,
  getSubgraphDescription,
  isSubgraph,
  updateSubgraphSpec,
} from "./subgraphUtils";

describe("subgraphUtils", () => {
  const createContainerTaskSpec = (): TaskSpec => ({
    componentRef: {
      spec: {
        implementation: {
          container: {
            image: "alpine",
            command: ["echo", "hello"],
          },
        },
      },
    },
  });

  const createGraphTaskSpec = (taskCount = 2): TaskSpec => ({
    componentRef: {
      spec: {
        name: "test-graph-component",
        implementation: {
          graph: {
            tasks: Object.fromEntries(
              Array.from({ length: taskCount }, (_, i) => [
                `task${i + 1}`,
                createContainerTaskSpec(),
              ]),
            ),
          },
        },
      },
    },
  });

  const createNestedGraphTaskSpec = (): TaskSpec => ({
    componentRef: {
      spec: {
        implementation: {
          graph: {
            tasks: {
              "container-task": createContainerTaskSpec(),
              "subgraph-task": createGraphTaskSpec(3),
            },
          },
        },
      },
    },
  });

  describe("isSubgraph", () => {
    it("should return false for container tasks", () => {
      const taskSpec = createContainerTaskSpec();
      expect(isSubgraph(taskSpec)).toBe(false);
    });

    it("should return true for graph tasks", () => {
      const taskSpec = createGraphTaskSpec();
      expect(isSubgraph(taskSpec)).toBe(true);
    });

    it("should return false for tasks without spec", () => {
      const taskSpec: TaskSpec = {
        componentRef: {},
      };
      expect(isSubgraph(taskSpec)).toBe(false);
    });
  });

  describe("getSubgraphDescription", () => {
    it("should return empty string for container tasks", () => {
      const taskSpec = createContainerTaskSpec();
      expect(getSubgraphDescription(taskSpec)).toBe("");
    });

    it("should return correct description for empty subgraph", () => {
      const taskSpec = createGraphTaskSpec(0);
      expect(getSubgraphDescription(taskSpec)).toBe("Empty subgraph");
    });

    it("should return correct description for single task", () => {
      const taskSpec = createGraphTaskSpec(1);
      expect(getSubgraphDescription(taskSpec)).toBe("1 task");
    });

    it("should return correct description for multiple tasks", () => {
      const taskSpec = createGraphTaskSpec(3);
      expect(getSubgraphDescription(taskSpec)).toBe("3 tasks");
    });

    it("should not include depth information for nested subgraphs", () => {
      const taskSpec = createNestedGraphTaskSpec();
      const description = getSubgraphDescription(taskSpec);
      expect(description).toBe("2 tasks");
    });
  });

  describe("getSubgraphComponentSpec", () => {
    const createRootComponentSpec = () => ({
      name: "root-component",
      inputs: [{ name: "rootInput", type: "string" }],
      outputs: [{ name: "rootOutput", type: "string" }],
      implementation: {
        graph: {
          tasks: {
            task1: createContainerTaskSpec(),
            subgraph1: createGraphTaskSpec(2),
          },
          outputValues: {},
        },
      },
    });

    it("should return original spec for root path", () => {
      const rootSpec = createRootComponentSpec();
      const result = getSubgraphComponentSpec(rootSpec, ["root"]);
      expect(result).toBe(rootSpec);
    });

    it("should return original spec for empty path", () => {
      const rootSpec = createRootComponentSpec();
      const result = getSubgraphComponentSpec(rootSpec, []);
      expect(result).toBe(rootSpec);
    });

    it("should navigate to subgraph", () => {
      const rootSpec = createRootComponentSpec();
      const result = getSubgraphComponentSpec(rootSpec, ["root", "subgraph1"]);

      // Should return the subgraph's component spec
      expect(result.name).toBe("test-graph-component");
      expect(result.implementation).toHaveProperty("graph");
    });

    it("should handle invalid task ID gracefully", () => {
      const rootSpec = createRootComponentSpec();
      const result = getSubgraphComponentSpec(rootSpec, [
        "root",
        "nonexistent",
      ]);

      // Should return original spec when navigation fails
      expect(result).toBe(rootSpec);
    });

    it("should handle non-subgraph task gracefully", () => {
      const rootSpec = createRootComponentSpec();
      const result = getSubgraphComponentSpec(rootSpec, ["root", "task1"]);

      // Should return original spec when trying to navigate into non-subgraph
      expect(result).toBe(rootSpec);
    });

    it("should call notify when task ID is invalid", () => {
      const rootSpec = createRootComponentSpec();
      const notify = vi.fn();

      const result = getSubgraphComponentSpec(
        rootSpec,
        ["root", "nonexistent"],
        notify,
      );

      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining('task "nonexistent" not found'),
        "warning",
      );
      expect(result).toBe(rootSpec);
    });

    it("should call notify when task is not a subgraph", () => {
      const rootSpec = createRootComponentSpec();
      const notify = vi.fn();

      const result = getSubgraphComponentSpec(
        rootSpec,
        ["root", "task1"],
        notify,
      );

      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining('task "task1" is not a subgraph'),
        "warning",
      );
      expect(result).toBe(rootSpec);
    });

    it("should call notify when task has no spec", () => {
      const rootSpec = {
        ...createRootComponentSpec(),
        implementation: {
          graph: {
            tasks: {
              "task-without-spec": {
                componentRef: {},
              },
            },
            outputValues: {},
          },
        },
      };
      const notify = vi.fn();

      const result = getSubgraphComponentSpec(
        rootSpec,
        ["root", "task-without-spec"],
        notify,
      );

      // Task without spec fails the isSubgraph check first
      expect(notify).toHaveBeenCalledWith(
        expect.stringContaining('task "task-without-spec" is not a subgraph'),
        "warning",
      );
      expect(result).toBe(rootSpec);
    });

    it("should not call notify on successful navigation", () => {
      const rootSpec = createRootComponentSpec();
      const notify = vi.fn();

      const result = getSubgraphComponentSpec(
        rootSpec,
        ["root", "subgraph1"],
        notify,
      );

      expect(notify).not.toHaveBeenCalled();
      expect(result.name).toBe("test-graph-component");
    });
  });

  describe("updateSubgraphSpec", () => {
    const createRootComponentSpec = () => ({
      name: "root-component",
      inputs: [{ name: "rootInput", type: "string" }],
      outputs: [{ name: "rootOutput", type: "string" }],
      implementation: {
        graph: {
          tasks: {
            task1: createContainerTaskSpec(),
            subgraph1: createGraphTaskSpec(2),
          },
          outputValues: {},
        },
      },
    });

    const createDeeplyNestedSpec = (): ComponentSpec => ({
      name: "root-component",
      implementation: {
        graph: {
          tasks: {
            "level1-subgraph": {
              componentRef: {
                spec: {
                  name: "level1-component",
                  implementation: {
                    graph: {
                      tasks: {
                        "level2-subgraph": {
                          componentRef: {
                            spec: {
                              name: "level2-component",
                              implementation: {
                                graph: {
                                  tasks: {
                                    "leaf-task": createContainerTaskSpec(),
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
            },
          },
          outputValues: {},
        },
      },
    });

    it("should return updated spec directly for root path", () => {
      const rootSpec = createRootComponentSpec();
      const updatedSpec: ComponentSpec = {
        ...rootSpec,
        name: "updated-root",
      };

      const result = updateSubgraphSpec(rootSpec, ["root"], updatedSpec);

      expect(result).toBe(updatedSpec);
      expect(result.name).toBe("updated-root");
    });

    it("should return updated spec directly for empty path", () => {
      const rootSpec = createRootComponentSpec();
      const updatedSpec: ComponentSpec = {
        ...rootSpec,
        name: "updated-root",
      };

      const result = updateSubgraphSpec(rootSpec, [], updatedSpec);

      expect(result).toBe(updatedSpec);
      expect(result.name).toBe("updated-root");
    });

    it("should update subgraph at depth 1", () => {
      const rootSpec = createRootComponentSpec();
      const updatedSubgraphSpec: ComponentSpec = {
        name: "updated-subgraph",
        implementation: {
          graph: {
            tasks: {
              "new-task": createContainerTaskSpec(),
            },
          },
        },
      };

      const result = updateSubgraphSpec(
        rootSpec,
        ["root", "subgraph1"],
        updatedSubgraphSpec,
      );

      // Root spec structure should be preserved
      expect(result.name).toBe("root-component");
      expect(result.inputs).toEqual(rootSpec.inputs);
      expect(result.outputs).toEqual(rootSpec.outputs);

      // Verify result has graph implementation
      expect(isGraphImplementation(result.implementation)).toBe(true);
      expect(isGraphImplementation(rootSpec.implementation)).toBe(true);
      if (!isGraphImplementation(result.implementation)) return;
      if (!isGraphImplementation(rootSpec.implementation)) return;

      // Subgraph should be updated
      const updatedSubgraph =
        result.implementation.graph.tasks["subgraph1"]?.componentRef.spec;
      expect(updatedSubgraph?.name).toBe("updated-subgraph");

      if (
        updatedSubgraph &&
        isGraphImplementation(updatedSubgraph.implementation)
      ) {
        expect(Object.keys(updatedSubgraph.implementation.graph.tasks)).toEqual(
          ["new-task"],
        );
      }

      // Other tasks should remain unchanged
      expect(result.implementation.graph.tasks["task1"]).toEqual(
        rootSpec.implementation.graph.tasks["task1"],
      );
    });

    it("should update deeply nested subgraph", () => {
      const rootSpec = createDeeplyNestedSpec();
      const updatedDeepSpec: ComponentSpec = {
        name: "updated-level2",
        implementation: {
          graph: {
            tasks: {
              "updated-leaf": createContainerTaskSpec(),
            },
          },
        },
      };

      const result = updateSubgraphSpec(
        rootSpec,
        ["root", "level1-subgraph", "level2-subgraph"],
        updatedDeepSpec,
      );

      // Navigate through the structure to verify the update
      expect(isGraphImplementation(result.implementation)).toBe(true);
      if (!isGraphImplementation(result.implementation)) return;

      const level1 =
        result.implementation.graph.tasks["level1-subgraph"]?.componentRef.spec;
      expect(level1?.name).toBe("level1-component");

      if (level1 && isGraphImplementation(level1.implementation)) {
        const level2 =
          level1.implementation.graph.tasks["level2-subgraph"]?.componentRef
            .spec;
        expect(level2?.name).toBe("updated-level2");

        if (level2 && isGraphImplementation(level2.implementation)) {
          expect(Object.keys(level2.implementation.graph.tasks)).toEqual([
            "updated-leaf",
          ]);
        }
      }
    });

    it("should maintain immutability of original spec", () => {
      const rootSpec = createRootComponentSpec();
      const originalRootName = rootSpec.name;

      expect(isGraphImplementation(rootSpec.implementation)).toBe(true);
      if (!isGraphImplementation(rootSpec.implementation)) return;

      const originalSubgraphName =
        rootSpec.implementation.graph.tasks["subgraph1"]?.componentRef.spec
          ?.name;

      const updatedSubgraphSpec: ComponentSpec = {
        name: "updated-subgraph",
        implementation: {
          graph: { tasks: {} },
        },
      };

      updateSubgraphSpec(rootSpec, ["root", "subgraph1"], updatedSubgraphSpec);

      // Original spec should remain unchanged
      expect(rootSpec.name).toBe(originalRootName);
      expect(
        rootSpec.implementation.graph.tasks["subgraph1"]?.componentRef.spec
          ?.name,
      ).toBe(originalSubgraphName);
    });

    it("should handle invalid task ID gracefully", () => {
      const rootSpec = createRootComponentSpec();
      const updatedSpec: ComponentSpec = {
        name: "should-not-be-applied",
        implementation: { graph: { tasks: {} } },
      };

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result = updateSubgraphSpec(
        rootSpec,
        ["root", "nonexistent"],
        updatedSpec,
      );

      // Should return original spec unchanged
      expect(result).toEqual(rootSpec);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('task "nonexistent" not found'),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle non-subgraph task gracefully", () => {
      const rootSpec = createRootComponentSpec();
      const updatedSpec: ComponentSpec = {
        name: "should-not-be-applied",
        implementation: { graph: { tasks: {} } },
      };

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result = updateSubgraphSpec(
        rootSpec,
        ["root", "task1"],
        updatedSpec,
      );

      // Should return original spec unchanged
      expect(result).toEqual(rootSpec);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('task "task1"'),
      );
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("is not a subgraph"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle task without spec gracefully", () => {
      const rootSpec: ComponentSpec = {
        name: "root",
        implementation: {
          graph: {
            tasks: {
              "subgraph-without-spec": {
                componentRef: {},
              },
            },
          },
        },
      };

      const updatedSpec: ComponentSpec = {
        name: "should-not-be-applied",
        implementation: { graph: { tasks: {} } },
      };

      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result = updateSubgraphSpec(
        rootSpec,
        ["root", "subgraph-without-spec"],
        updatedSpec,
      );

      // Should return original spec unchanged
      expect(result).toEqual(rootSpec);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it("should create new objects at each level", () => {
      const rootSpec = createDeeplyNestedSpec();
      const updatedSpec: ComponentSpec = {
        name: "updated",
        implementation: { graph: { tasks: {} } },
      };

      const result = updateSubgraphSpec(
        rootSpec,
        ["root", "level1-subgraph", "level2-subgraph"],
        updatedSpec,
      );

      // Each level should be a new object reference
      expect(result).not.toBe(rootSpec);
      expect(result.implementation).not.toBe(rootSpec.implementation);

      expect(isGraphImplementation(result.implementation)).toBe(true);
      expect(isGraphImplementation(rootSpec.implementation)).toBe(true);
      if (!isGraphImplementation(result.implementation)) return;
      if (!isGraphImplementation(rootSpec.implementation)) return;

      expect(result.implementation.graph).not.toBe(
        rootSpec.implementation.graph,
      );
      expect(result.implementation.graph.tasks).not.toBe(
        rootSpec.implementation.graph.tasks,
      );

      const level1Result = result.implementation.graph.tasks["level1-subgraph"];
      const level1Original =
        rootSpec.implementation.graph.tasks["level1-subgraph"];

      expect(level1Result).not.toBe(level1Original);
      expect(level1Result?.componentRef).not.toBe(level1Original?.componentRef);
      expect(level1Result?.componentRef.spec).not.toBe(
        level1Original?.componentRef.spec,
      );
    });

    it("should preserve sibling tasks and properties", () => {
      const rootSpec: ComponentSpec = {
        name: "root",
        inputs: [{ name: "input1", type: "string" }],
        outputs: [{ name: "output1", type: "string" }],
        implementation: {
          graph: {
            tasks: {
              subgraph1: createGraphTaskSpec(2),
              subgraph2: createGraphTaskSpec(3),
              task1: createContainerTaskSpec(),
            },
            outputValues: {
              output1: { taskOutput: { taskId: "task1", outputName: "test" } },
            },
          },
        },
      };

      const updatedSpec: ComponentSpec = {
        name: "updated-subgraph1",
        implementation: { graph: { tasks: {} } },
      };

      const result = updateSubgraphSpec(
        rootSpec,
        ["root", "subgraph1"],
        updatedSpec,
      );

      // Root properties should be preserved
      expect(result.name).toBe("root");
      expect(result.inputs).toEqual(rootSpec.inputs);
      expect(result.outputs).toEqual(rootSpec.outputs);

      expect(isGraphImplementation(result.implementation)).toBe(true);
      expect(isGraphImplementation(rootSpec.implementation)).toBe(true);
      if (!isGraphImplementation(result.implementation)) return;
      if (!isGraphImplementation(rootSpec.implementation)) return;

      expect(result.implementation.graph.outputValues).toEqual(
        rootSpec.implementation.graph.outputValues,
      );

      // Sibling tasks should be preserved
      expect(result.implementation.graph.tasks["subgraph2"]).toEqual(
        rootSpec.implementation.graph.tasks["subgraph2"],
      );
      expect(result.implementation.graph.tasks["task1"]).toEqual(
        rootSpec.implementation.graph.tasks["task1"],
      );

      // Only target subgraph should be updated
      expect(
        result.implementation.graph.tasks["subgraph1"]?.componentRef.spec?.name,
      ).toBe("updated-subgraph1");
    });

    describe("output renaming propagation", () => {
      it("should update parent outputValues when subgraph output is renamed", () => {
        const rootSpec: ComponentSpec = {
          name: "root",
          outputs: [{ name: "rootOutput", type: "string" }],
          implementation: {
            graph: {
              tasks: {
                subgraph1: {
                  componentRef: {
                    spec: {
                      name: "subgraph",
                      outputs: [{ name: "oldOutputName", type: "string" }],
                      implementation: {
                        graph: {
                          tasks: {
                            innerTask: createContainerTaskSpec(),
                          },
                        },
                      },
                    },
                  },
                },
              },
              outputValues: {
                rootOutput: {
                  taskOutput: {
                    taskId: "subgraph1",
                    outputName: "oldOutputName",
                  },
                },
              },
            },
          },
        };

        const updatedSubgraphSpec: ComponentSpec = {
          name: "subgraph",
          outputs: [{ name: "newOutputName", type: "string" }],
          implementation: {
            graph: {
              tasks: {
                innerTask: createContainerTaskSpec(),
              },
            },
          },
        };

        const result = updateSubgraphSpec(
          rootSpec,
          ["root", "subgraph1"],
          updatedSubgraphSpec,
        );

        expect(isGraphImplementation(result.implementation)).toBe(true);
        if (!isGraphImplementation(result.implementation)) return;

        // Parent output should now reference the new output name
        expect(result.implementation.graph.outputValues?.rootOutput).toEqual({
          taskOutput: {
            taskId: "subgraph1",
            outputName: "newOutputName",
          },
        });
      });

      it("should update sibling task arguments when subgraph output is renamed", () => {
        const rootSpec: ComponentSpec = {
          name: "root",
          implementation: {
            graph: {
              tasks: {
                subgraph1: {
                  componentRef: {
                    spec: {
                      name: "subgraph",
                      outputs: [{ name: "oldOutputName", type: "string" }],
                      implementation: {
                        graph: {
                          tasks: {
                            innerTask: createContainerTaskSpec(),
                          },
                        },
                      },
                    },
                  },
                },
                consumerTask: {
                  componentRef: {
                    spec: {
                      name: "consumer",
                      inputs: [{ name: "input1", type: "string" }],
                      implementation: {
                        container: {
                          image: "consumer:latest",
                        },
                      },
                    },
                  },
                  arguments: {
                    input1: {
                      taskOutput: {
                        taskId: "subgraph1",
                        outputName: "oldOutputName",
                      },
                    },
                  },
                },
              },
            },
          },
        };

        const updatedSubgraphSpec: ComponentSpec = {
          name: "subgraph",
          outputs: [{ name: "newOutputName", type: "string" }],
          implementation: {
            graph: {
              tasks: {
                innerTask: createContainerTaskSpec(),
              },
            },
          },
        };

        const result = updateSubgraphSpec(
          rootSpec,
          ["root", "subgraph1"],
          updatedSubgraphSpec,
        );

        expect(isGraphImplementation(result.implementation)).toBe(true);
        if (!isGraphImplementation(result.implementation)) return;

        // Consumer task should now reference the new output name
        const consumerTask = result.implementation.graph.tasks.consumerTask;
        expect(consumerTask?.arguments?.input1).toEqual({
          taskOutput: {
            taskId: "subgraph1",
            outputName: "newOutputName",
          },
        });
      });

      it("should update both outputValues and task arguments together", () => {
        const rootSpec: ComponentSpec = {
          name: "root",
          outputs: [{ name: "rootOutput", type: "string" }],
          implementation: {
            graph: {
              tasks: {
                subgraph1: {
                  componentRef: {
                    spec: {
                      name: "subgraph",
                      outputs: [{ name: "oldOutputName", type: "string" }],
                      implementation: {
                        graph: {
                          tasks: {
                            innerTask: createContainerTaskSpec(),
                          },
                        },
                      },
                    },
                  },
                },
                consumerTask: {
                  componentRef: {
                    spec: {
                      name: "consumer",
                      inputs: [{ name: "input1", type: "string" }],
                      implementation: {
                        container: {
                          image: "consumer:latest",
                        },
                      },
                    },
                  },
                  arguments: {
                    input1: {
                      taskOutput: {
                        taskId: "subgraph1",
                        outputName: "oldOutputName",
                      },
                    },
                  },
                },
              },
              outputValues: {
                rootOutput: {
                  taskOutput: {
                    taskId: "subgraph1",
                    outputName: "oldOutputName",
                  },
                },
              },
            },
          },
        };

        const updatedSubgraphSpec: ComponentSpec = {
          name: "subgraph",
          outputs: [{ name: "newOutputName", type: "string" }],
          implementation: {
            graph: {
              tasks: {
                innerTask: createContainerTaskSpec(),
              },
            },
          },
        };

        const result = updateSubgraphSpec(
          rootSpec,
          ["root", "subgraph1"],
          updatedSubgraphSpec,
        );

        expect(isGraphImplementation(result.implementation)).toBe(true);
        if (!isGraphImplementation(result.implementation)) return;

        // Both should be updated
        expect(result.implementation.graph.outputValues?.rootOutput).toEqual({
          taskOutput: {
            taskId: "subgraph1",
            outputName: "newOutputName",
          },
        });

        const consumerTask = result.implementation.graph.tasks.consumerTask;
        expect(consumerTask?.arguments?.input1).toEqual({
          taskOutput: {
            taskId: "subgraph1",
            outputName: "newOutputName",
          },
        });
      });

      it("should handle output renaming at multiple nesting levels", () => {
        const rootSpec: ComponentSpec = {
          name: "root",
          outputs: [{ name: "rootOutput", type: "string" }],
          implementation: {
            graph: {
              tasks: {
                level1: {
                  componentRef: {
                    spec: {
                      name: "level1",
                      outputs: [{ name: "level1Output", type: "string" }],
                      implementation: {
                        graph: {
                          tasks: {
                            level2: {
                              componentRef: {
                                spec: {
                                  name: "level2",
                                  outputs: [
                                    { name: "oldOutputName", type: "string" },
                                  ],
                                  implementation: {
                                    graph: {
                                      tasks: {
                                        innerTask: createContainerTaskSpec(),
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                          outputValues: {
                            level1Output: {
                              taskOutput: {
                                taskId: "level2",
                                outputName: "oldOutputName",
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              outputValues: {
                rootOutput: {
                  taskOutput: {
                    taskId: "level1",
                    outputName: "level1Output",
                  },
                },
              },
            },
          },
        };

        const updatedLevel2Spec: ComponentSpec = {
          name: "level2",
          outputs: [{ name: "newOutputName", type: "string" }],
          implementation: {
            graph: {
              tasks: {
                innerTask: createContainerTaskSpec(),
              },
            },
          },
        };

        const result = updateSubgraphSpec(
          rootSpec,
          ["root", "level1", "level2"],
          updatedLevel2Spec,
        );

        expect(isGraphImplementation(result.implementation)).toBe(true);
        if (!isGraphImplementation(result.implementation)) return;

        // Check level1's outputValues were updated
        const level1Task = result.implementation.graph.tasks.level1;
        const level1Spec = level1Task?.componentRef.spec;
        expect(level1Spec).toBeDefined();

        if (level1Spec && isGraphImplementation(level1Spec.implementation)) {
          expect(
            level1Spec.implementation.graph.outputValues?.level1Output,
          ).toEqual({
            taskOutput: {
              taskId: "level2",
              outputName: "newOutputName",
            },
          });
        }
      });

      it("should not affect unrelated outputs", () => {
        const rootSpec: ComponentSpec = {
          name: "root",
          outputs: [
            { name: "output1", type: "string" },
            { name: "output2", type: "string" },
          ],
          implementation: {
            graph: {
              tasks: {
                subgraph1: {
                  componentRef: {
                    spec: {
                      name: "subgraph",
                      outputs: [{ name: "oldOutputName", type: "string" }],
                      implementation: {
                        graph: {
                          tasks: {
                            innerTask: createContainerTaskSpec(),
                          },
                        },
                      },
                    },
                  },
                },
                otherTask: createContainerTaskSpec(),
              },
              outputValues: {
                output1: {
                  taskOutput: {
                    taskId: "subgraph1",
                    outputName: "oldOutputName",
                  },
                },
                output2: {
                  taskOutput: {
                    taskId: "otherTask",
                    outputName: "unrelatedOutput",
                  },
                },
              },
            },
          },
        };

        const updatedSubgraphSpec: ComponentSpec = {
          name: "subgraph",
          outputs: [{ name: "newOutputName", type: "string" }],
          implementation: {
            graph: {
              tasks: {
                innerTask: createContainerTaskSpec(),
              },
            },
          },
        };

        const result = updateSubgraphSpec(
          rootSpec,
          ["root", "subgraph1"],
          updatedSubgraphSpec,
        );

        expect(isGraphImplementation(result.implementation)).toBe(true);
        if (!isGraphImplementation(result.implementation)) return;

        // output1 should be updated
        expect(result.implementation.graph.outputValues?.output1).toEqual({
          taskOutput: {
            taskId: "subgraph1",
            outputName: "newOutputName",
          },
        });

        // output2 should be unchanged
        expect(result.implementation.graph.outputValues?.output2).toEqual({
          taskOutput: {
            taskId: "otherTask",
            outputName: "unrelatedOutput",
          },
        });
      });
    });
  });
});
