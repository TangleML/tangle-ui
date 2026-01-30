import { beforeEach, describe, expect, it, vi } from "vitest";

import addTask from "@/components/shared/ReactFlow/FlowCanvas/utils/addTask";
import { setGraphOutputValue } from "@/components/shared/ReactFlow/FlowCanvas/utils/setGraphOutputValue";
import { setTaskArgument } from "@/components/shared/ReactFlow/FlowCanvas/utils/setTaskArgument";
import {
  type ArgumentType,
  type ComponentSpec,
  type GraphSpec,
  type InputSpec,
  isGraphImplementation,
  type OutputSpec,
  type TaskOutputArgument,
  type TaskSpec,
} from "@/utils/componentSpec";
import {
  getArgumentsWithUpstreamConnections,
  getDownstreamTaskNodesConnectedToTask,
  getOutputNodesConnectedToTask,
} from "@/utils/graphUtils";

import {
  copyOutputValues,
  reconnectDownstreamOutputs,
  reconnectDownstreamTasks,
  reconnectUpstreamInputsAndTasks,
  unpackInputs,
  unpackOutputs,
  unpackTasks,
} from "./helpers";

// Mock dependencies
vi.mock("@/components/shared/ReactFlow/FlowCanvas/utils/addTask");
vi.mock("@/components/shared/ReactFlow/FlowCanvas/utils/setGraphOutputValue");
vi.mock("@/components/shared/ReactFlow/FlowCanvas/utils/setTaskArgument");
vi.mock("@/utils/graphUtils");

const mockPosition = { x: 100, y: 100 };

const createMockComponentSpec = (
  tasks: Record<string, TaskSpec> = {},
  outputValues: Record<string, TaskOutputArgument> = {},
): ComponentSpec => ({
  name: "test-component",
  inputs: [],
  outputs: [],
  implementation: {
    graph: {
      tasks,
      outputValues,
    },
  },
});

const createMockInputSpec = (name: string, value?: any): InputSpec => ({
  name,
  type: "String",
  annotations: {
    "editor.position": JSON.stringify(mockPosition),
  },
  ...(value !== undefined && { value }),
});

const createMockOutputSpec = (name: string): OutputSpec => ({
  name,
  type: "String",
  annotations: {
    "editor.position": JSON.stringify(mockPosition),
  },
});

const createMockTaskSpec = (args?: Record<string, ArgumentType>): TaskSpec => ({
  componentRef: { name: "test-component" },
  arguments: args,
  annotations: {
    "editor.position": JSON.stringify(mockPosition),
  },
});

const createTaskOutputArgument = (
  taskId: string,
  outputName: string,
): TaskOutputArgument => ({
  taskOutput: {
    taskId,
    outputName,
    type: "String",
  },
});

const createGraphInputArgument = (inputName: string): ArgumentType => ({
  graphInput: {
    inputName,
    type: "String",
  },
});

describe("unpackInputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should unpack input nodes without external connections", () => {
    vi.mocked(addTask).mockReturnValue({
      spec: createMockComponentSpec(),
      ioName: "input1",
      taskId: undefined,
    });

    const containerSpec = createMockComponentSpec();
    containerSpec.inputs = [createMockInputSpec("input1")];

    const result = unpackInputs(
      containerSpec,
      mockPosition,
      {},
      createMockComponentSpec(),
    );

    expect(addTask).toHaveBeenCalledTimes(1);
    expect(result.inputNameMap.size).toBe(0);
  });

  it("should skip inputs with TaskOutputArgument connections", () => {
    const containerSpec = createMockComponentSpec();
    containerSpec.inputs = [createMockInputSpec("input1")];

    const containerArguments = {
      input1: createTaskOutputArgument("task1", "output1"),
    };

    const result = unpackInputs(
      containerSpec,
      mockPosition,
      containerArguments,
      createMockComponentSpec(),
    );

    expect(addTask).not.toHaveBeenCalled();
    expect(result.inputNameMap.size).toBe(0);
  });

  it("should skip inputs with GraphInputArgument connections", () => {
    const containerSpec = createMockComponentSpec();
    containerSpec.inputs = [createMockInputSpec("input1")];

    const containerArguments = {
      input1: createGraphInputArgument("parent-input"),
    };

    const result = unpackInputs(
      containerSpec,
      mockPosition,
      containerArguments,
      createMockComponentSpec(),
    );

    expect(addTask).not.toHaveBeenCalled();
    expect(result.inputNameMap.size).toBe(0);
  });

  it("should apply static argument values to inputs", () => {
    vi.mocked(addTask).mockReturnValue({
      spec: createMockComponentSpec(),
      ioName: "input1",
      taskId: undefined,
    });

    const containerSpec = createMockComponentSpec();
    containerSpec.inputs = [createMockInputSpec("input1")];

    const containerArguments = {
      input1: "static-value",
    };

    unpackInputs(
      containerSpec,
      mockPosition,
      containerArguments,
      createMockComponentSpec(),
    );

    expect(addTask).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(addTask).mock.calls[0];

    expect(callArgs[0]).toBe("input");
    expect(callArgs[1]).toBeNull();
    expect(callArgs[4]).toMatchObject({
      name: "input1",
      type: "String",
      value: "static-value",
    });
  });

  it("should track input name changes", () => {
    vi.mocked(addTask).mockReturnValue({
      spec: createMockComponentSpec(),
      ioName: "input1-renamed",
      taskId: undefined,
    });

    const containerSpec = createMockComponentSpec();
    containerSpec.inputs = [createMockInputSpec("input1")];

    const result = unpackInputs(
      containerSpec,
      mockPosition,
      {},
      createMockComponentSpec(),
    );

    expect(result.inputNameMap.get("input1")).toBe("input1-renamed");
  });

  it("should not apply undefined values to inputs", () => {
    vi.mocked(addTask).mockReturnValue({
      spec: createMockComponentSpec(),
      ioName: "input1",
      taskId: undefined,
    });

    const containerSpec = createMockComponentSpec();
    containerSpec.inputs = [createMockInputSpec("input1")];

    unpackInputs(containerSpec, mockPosition, {}, createMockComponentSpec());

    expect(addTask).toHaveBeenCalledTimes(1);
    const callArgs = vi.mocked(addTask).mock.calls[0];

    expect(callArgs[0]).toBe("input");
    expect(callArgs[1]).toBeNull();
    expect(callArgs[4]).toHaveProperty("name", "input1");
    expect(callArgs[4]).toHaveProperty("value", undefined);
  });
});

describe("unpackOutputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should unpack output nodes without external connections", () => {
    vi.mocked(addTask).mockReturnValue({
      spec: createMockComponentSpec(),
      ioName: "output1",
      taskId: undefined,
    });

    const containerSpec = createMockComponentSpec();
    containerSpec.outputs = [createMockOutputSpec("output1")];

    const result = unpackOutputs(
      containerSpec,
      mockPosition,
      createMockComponentSpec(),
      {},
      {},
    );

    expect(addTask).toHaveBeenCalledTimes(1);
    expect(result.outputNameMap.size).toBe(0);
  });

  it("should skip outputs connected to graph output nodes", () => {
    const containerSpec = createMockComponentSpec();
    containerSpec.outputs = [createMockOutputSpec("output1")];

    const outputNodesConnected = {
      "graph-output": createTaskOutputArgument("subgraph", "output1"),
    };

    const result = unpackOutputs(
      containerSpec,
      mockPosition,
      createMockComponentSpec(),
      outputNodesConnected,
      {},
    );

    expect(addTask).not.toHaveBeenCalled();
    expect(result.outputNameMap.size).toBe(0);
  });

  it("should skip outputs connected to downstream tasks", () => {
    const containerSpec = createMockComponentSpec();
    containerSpec.outputs = [createMockOutputSpec("output1")];

    const tasksConnectedDownstream = {
      "downstream-task": {
        arg1: createTaskOutputArgument("subgraph", "output1"),
      },
    };

    const result = unpackOutputs(
      containerSpec,
      mockPosition,
      createMockComponentSpec(),
      {},
      tasksConnectedDownstream,
    );

    expect(addTask).not.toHaveBeenCalled();
    expect(result.outputNameMap.size).toBe(0);
  });

  it("should track output name changes", () => {
    vi.mocked(addTask).mockReturnValue({
      spec: createMockComponentSpec(),
      ioName: "output1-renamed",
      taskId: undefined,
    });

    const containerSpec = createMockComponentSpec();
    containerSpec.outputs = [createMockOutputSpec("output1")];

    const result = unpackOutputs(
      containerSpec,
      mockPosition,
      createMockComponentSpec(),
      {},
      {},
    );

    expect(result.outputNameMap.get("output1")).toBe("output1-renamed");
  });
});

describe("unpackTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should unpack tasks in two passes", () => {
    vi.mocked(addTask)
      .mockReturnValueOnce({
        spec: createMockComponentSpec({
          "task1-new": createMockTaskSpec(),
        }),
        taskId: "task1-new",
      })
      .mockReturnValueOnce({
        spec: createMockComponentSpec({
          "task1-new": createMockTaskSpec(),
          "task2-new": createMockTaskSpec(),
        }),
        taskId: "task2-new",
      });

    const containerSpec = createMockComponentSpec({
      task1: createMockTaskSpec(),
      task2: createMockTaskSpec({
        input: createTaskOutputArgument("task1", "output"),
      }),
    });

    const result = unpackTasks(
      containerSpec,
      mockPosition,
      createMockComponentSpec(),
      new Map(),
    );

    expect(addTask).toHaveBeenCalledTimes(2);
    expect(result.taskIdMap.get("task1")).toBe("task1-new");
    expect(result.taskIdMap.get("task2")).toBe("task2-new");
  });

  it("should remap task arguments with taskIdMap", () => {
    vi.mocked(addTask)
      .mockReturnValueOnce({
        spec: createMockComponentSpec({
          "task1-new": createMockTaskSpec(),
        }),
        taskId: "task1-new",
      })
      .mockReturnValueOnce({
        spec: createMockComponentSpec({
          "task1-new": createMockTaskSpec(),
          "task2-new": createMockTaskSpec(),
        }),
        taskId: "task2-new",
      });

    const containerSpec = createMockComponentSpec({
      task1: createMockTaskSpec(),
      task2: createMockTaskSpec({
        input: createTaskOutputArgument("task1", "output"),
      }),
    });

    const result = unpackTasks(
      containerSpec,
      mockPosition,
      createMockComponentSpec(),
      new Map(),
    );

    const implementation = result.spec.implementation;

    if (!implementation || !isGraphImplementation(implementation)) {
      throw new Error("Unpacked spec is not a graph implementation");
    }

    const task2 = implementation.graph.tasks["task2-new"];
    expect(task2.arguments?.input).toEqual({
      taskOutput: {
        taskId: "task1-new",
        outputName: "output",
        type: "String",
      },
    });
  });

  it("should remap graph input arguments with inputNameMap", () => {
    vi.mocked(addTask).mockReturnValue({
      spec: createMockComponentSpec({
        "task1-new": createMockTaskSpec(),
      }),
      taskId: "task1-new",
    });

    const containerSpec = createMockComponentSpec({
      task1: createMockTaskSpec({
        input: createGraphInputArgument("input1"),
      }),
    });

    const inputNameMap = new Map([["input1", "input1-renamed"]]);

    const result = unpackTasks(
      containerSpec,
      mockPosition,
      createMockComponentSpec(),
      inputNameMap,
    );

    const implementation = result.spec.implementation;

    if (!implementation || !isGraphImplementation(implementation)) {
      throw new Error("Unpacked spec is not a graph implementation");
    }

    const task1 = implementation.graph.tasks["task1-new"];
    expect(task1.arguments?.input).toEqual({
      graphInput: {
        inputName: "input1-renamed",
        type: "String",
      },
    });
  });

  it("should return empty taskIdMap for non-graph implementation", () => {
    const containerSpec: ComponentSpec = {
      name: "test",
      inputs: [],
      outputs: [],
      implementation: {
        container: {
          image: "test",
        },
      },
    };

    const result = unpackTasks(
      containerSpec,
      mockPosition,
      createMockComponentSpec(),
      new Map(),
    );

    expect(result.taskIdMap.size).toBe(0);
  });

  it("should handle tasks with no arguments", () => {
    vi.mocked(addTask).mockReturnValue({
      spec: createMockComponentSpec({
        "task1-new": createMockTaskSpec(),
      }),
      taskId: "task1-new",
    });

    const containerSpec = createMockComponentSpec({
      task1: createMockTaskSpec(),
    });

    const result = unpackTasks(
      containerSpec,
      mockPosition,
      createMockComponentSpec(),
      new Map(),
    );

    expect(result.taskIdMap.get("task1")).toBe("task1-new");
  });
});

describe("copyOutputValues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should copy output values without external connections", () => {
    const mockGraphSpec = {
      tasks: {},
      outputValues: { output1: createTaskOutputArgument("task1", "out") },
    };
    vi.mocked(setGraphOutputValue).mockReturnValue(mockGraphSpec);

    const containerSpec = createMockComponentSpec(
      { task1: createMockTaskSpec() },
      { output1: createTaskOutputArgument("task1", "out") },
    );

    const outputNameMap = new Map([["output1", "output1-renamed"]]);
    const taskIdMap = new Map([["task1", "task1-new"]]);

    copyOutputValues(
      containerSpec,
      createMockComponentSpec(),
      outputNameMap,
      taskIdMap,
      {},
      {},
    );

    expect(setGraphOutputValue).toHaveBeenCalledWith(
      expect.any(Object),
      "output1-renamed",
      {
        taskOutput: {
          taskId: "task1-new",
          outputName: "out",
          type: "String",
        },
      },
    );
  });

  it("should skip output values connected to graph outputs", () => {
    const containerSpec = createMockComponentSpec(
      {},
      { output1: createTaskOutputArgument("task1", "out") },
    );

    const outputNodesConnected = {
      "graph-output": createTaskOutputArgument("subgraph", "output1"),
    };

    copyOutputValues(
      containerSpec,
      createMockComponentSpec(),
      new Map(),
      new Map(),
      outputNodesConnected,
      {},
    );

    expect(setGraphOutputValue).not.toHaveBeenCalled();
  });

  it("should skip output values connected to downstream tasks", () => {
    const containerSpec = createMockComponentSpec(
      {},
      { output1: createTaskOutputArgument("task1", "out") },
    );

    const tasksConnectedDownstream = {
      "downstream-task": {
        arg1: createTaskOutputArgument("subgraph", "output1"),
      },
    };

    copyOutputValues(
      containerSpec,
      createMockComponentSpec(),
      new Map(),
      new Map(),
      {},
      tasksConnectedDownstream,
    );

    expect(setGraphOutputValue).not.toHaveBeenCalled();
  });

  it("should return spec unchanged for non-graph implementation", () => {
    const containerSpec: ComponentSpec = {
      name: "test",
      inputs: [],
      outputs: [],
      implementation: {
        container: {
          image: "test",
        },
      },
    };

    const inputSpec = createMockComponentSpec();
    const result = copyOutputValues(
      containerSpec,
      inputSpec,
      new Map(),
      new Map(),
      {},
      {},
    );

    expect(result).toBe(inputSpec);
    expect(setGraphOutputValue).not.toHaveBeenCalled();
  });
});

describe("reconnectUpstreamInputsAndTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reconnect upstream connections to internal tasks", () => {
    const mockGraphSpec: GraphSpec = {
      tasks: {
        "internal-task": createMockTaskSpec({
          param1: createGraphInputArgument("input1"),
        }),
      },
    };

    vi.mocked(getArgumentsWithUpstreamConnections).mockReturnValue({
      input1: createTaskOutputArgument("upstream-task", "output"),
    });

    vi.mocked(setTaskArgument).mockReturnValue(mockGraphSpec);

    const taskIdMap = new Map([["internal-task", "internal-task-new"]]);

    reconnectUpstreamInputsAndTasks(
      mockGraphSpec,
      "subgraph",
      mockGraphSpec,
      createMockComponentSpec(),
      taskIdMap,
    );

    expect(setTaskArgument).toHaveBeenCalledWith(
      expect.any(Object),
      "internal-task-new",
      "param1",
      createTaskOutputArgument("upstream-task", "output"),
    );
  });

  it("should skip tasks that don't use the input", () => {
    const mockGraphSpec: GraphSpec = {
      tasks: {
        "internal-task": createMockTaskSpec({
          param1: createGraphInputArgument("different-input"),
        }),
      },
    };

    vi.mocked(getArgumentsWithUpstreamConnections).mockReturnValue({
      input1: createTaskOutputArgument("upstream-task", "output"),
    });

    reconnectUpstreamInputsAndTasks(
      mockGraphSpec,
      "subgraph",
      mockGraphSpec,
      createMockComponentSpec(),
      new Map(),
    );

    expect(setTaskArgument).not.toHaveBeenCalled();
  });

  it("should handle multiple parameters using the same input", () => {
    const mockGraphSpec: GraphSpec = {
      tasks: {
        "internal-task": createMockTaskSpec({
          param1: createGraphInputArgument("input1"),
          param2: createGraphInputArgument("input1"),
        }),
      },
    };

    vi.mocked(getArgumentsWithUpstreamConnections).mockReturnValue({
      input1: createTaskOutputArgument("upstream-task", "output"),
    });

    vi.mocked(setTaskArgument).mockReturnValue(mockGraphSpec);

    const taskIdMap = new Map([["internal-task", "internal-task-new"]]);

    reconnectUpstreamInputsAndTasks(
      mockGraphSpec,
      "subgraph",
      mockGraphSpec,
      createMockComponentSpec(),
      taskIdMap,
    );

    expect(setTaskArgument).toHaveBeenCalledTimes(2);
  });
});

describe("reconnectDownstreamOutputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reconnect graph outputs to internal tasks", () => {
    const mockGraphSpec = {
      tasks: {},
      outputValues: {
        "internal-output": createTaskOutputArgument("internal-task", "out"),
      },
    };

    vi.mocked(getOutputNodesConnectedToTask).mockReturnValue({
      "graph-output": createTaskOutputArgument("subgraph", "internal-output"),
    });

    vi.mocked(setGraphOutputValue).mockReturnValue(mockGraphSpec);

    const taskIdMap = new Map([["internal-task", "internal-task-new"]]);

    reconnectDownstreamOutputs(
      mockGraphSpec,
      "subgraph",
      mockGraphSpec,
      createMockComponentSpec(),
      taskIdMap,
    );

    expect(setGraphOutputValue).toHaveBeenCalledWith(
      expect.any(Object),
      "graph-output",
      {
        taskOutput: {
          taskId: "internal-task-new",
          outputName: "out",
          type: "String",
        },
      },
    );
  });

  it("should skip if internal output value doesn't exist", () => {
    const mockGraphSpec: GraphSpec = {
      tasks: {},
      outputValues: {},
    };

    vi.mocked(getOutputNodesConnectedToTask).mockReturnValue({
      "graph-output": createTaskOutputArgument("subgraph", "missing-output"),
    });

    reconnectDownstreamOutputs(
      mockGraphSpec,
      "subgraph",
      mockGraphSpec,
      createMockComponentSpec(),
      new Map(),
    );

    expect(setGraphOutputValue).not.toHaveBeenCalled();
  });

  it("should skip if output name doesn't match", () => {
    const mockGraphSpec: GraphSpec = {
      tasks: {},
      outputValues: {
        "internal-output": createTaskOutputArgument("internal-task", "out"),
      },
    };

    vi.mocked(getOutputNodesConnectedToTask).mockReturnValue({
      "graph-output": createTaskOutputArgument("subgraph", "different-output"),
    });

    reconnectDownstreamOutputs(
      mockGraphSpec,
      "subgraph",
      mockGraphSpec,
      createMockComponentSpec(),
      new Map(),
    );

    expect(setGraphOutputValue).not.toHaveBeenCalled();
  });
});

describe("reconnectDownstreamTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reconnect downstream tasks to internal tasks", () => {
    const mockGraphSpec: GraphSpec = {
      tasks: {},
      outputValues: {
        "internal-output": createTaskOutputArgument("internal-task", "out"),
      },
    };

    vi.mocked(getDownstreamTaskNodesConnectedToTask).mockReturnValue({
      "downstream-task": {
        arg1: createTaskOutputArgument("subgraph", "internal-output"),
      },
    });

    vi.mocked(setTaskArgument).mockReturnValue(mockGraphSpec);

    const taskIdMap = new Map([["internal-task", "internal-task-new"]]);

    reconnectDownstreamTasks(
      mockGraphSpec,
      "subgraph",
      mockGraphSpec,
      createMockComponentSpec(),
      taskIdMap,
    );

    expect(setTaskArgument).toHaveBeenCalledWith(
      expect.any(Object),
      "downstream-task",
      "arg1",
      {
        taskOutput: {
          taskId: "internal-task-new",
          outputName: "out",
          type: "String",
        },
      },
    );
  });

  it("should skip if internal output value doesn't exist", () => {
    const mockGraphSpec: GraphSpec = {
      tasks: {},
      outputValues: {},
    };

    vi.mocked(getDownstreamTaskNodesConnectedToTask).mockReturnValue({
      "downstream-task": {
        arg1: createTaskOutputArgument("subgraph", "missing-output"),
      },
    });

    reconnectDownstreamTasks(
      mockGraphSpec,
      "subgraph",
      mockGraphSpec,
      createMockComponentSpec(),
      new Map(),
    );

    expect(setTaskArgument).not.toHaveBeenCalled();
  });

  it("should handle multiple arguments from same downstream task", () => {
    const mockGraphSpec: GraphSpec = {
      tasks: {},
      outputValues: {
        output1: createTaskOutputArgument("internal-task", "out1"),
        output2: createTaskOutputArgument("internal-task", "out2"),
      },
    };

    vi.mocked(getDownstreamTaskNodesConnectedToTask).mockReturnValue({
      "downstream-task": {
        arg1: createTaskOutputArgument("subgraph", "output1"),
        arg2: createTaskOutputArgument("subgraph", "output2"),
      },
    });

    vi.mocked(setTaskArgument).mockReturnValue(mockGraphSpec);

    const taskIdMap = new Map([["internal-task", "internal-task-new"]]);

    reconnectDownstreamTasks(
      mockGraphSpec,
      "subgraph",
      mockGraphSpec,
      createMockComponentSpec(),
      taskIdMap,
    );

    expect(setTaskArgument).toHaveBeenCalledTimes(2);
  });
});
