import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ComponentSpec,
  TaskOutputArgument,
  TaskSpec,
} from "@/utils/componentSpec";
import {
  getDownstreamTaskNodesConnectedToTask,
  getOutputNodesConnectedToTask,
} from "@/utils/graphUtils";
import { extractPositionFromAnnotations } from "@/utils/nodes/extractPositionFromAnnotations";

import {
  copyOutputValues,
  reconnectDownstreamOutputs,
  reconnectDownstreamTasks,
  reconnectUpstreamInputsAndTasks,
  unpackInputs,
  unpackOutputs,
  unpackTasks,
} from "./helpers";
import { unpackSubgraph } from "./unpackSubgraph";

// Mock dependencies
vi.mock("@/utils/nodes/extractPositionFromAnnotations");
vi.mock("@/utils/graphUtils");
vi.mock("./helpers");

const mockPosition = { x: 100, y: 100 };

const createMockComponentSpec = (
  tasks: Record<string, TaskSpec> = {},
  outputValues: Record<string, TaskOutputArgument> = {},
  inputs: any[] = [],
  outputs: any[] = [],
): ComponentSpec => ({
  name: "test-component",
  inputs,
  outputs,
  implementation: {
    graph: {
      tasks,
      outputValues,
    },
  },
});

const createMockTaskSpec = (
  componentRef: ComponentSpec,
  args?: Record<string, any>,
  annotations?: Record<string, any>,
): TaskSpec => ({
  componentRef: { spec: componentRef },
  arguments: args,
  annotations: annotations || {
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

describe("unpackSubgraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(extractPositionFromAnnotations).mockReturnValue(mockPosition);
    vi.mocked(getOutputNodesConnectedToTask).mockReturnValue({});
    vi.mocked(getDownstreamTaskNodesConnectedToTask).mockReturnValue({});
  });

  it("should return unchanged spec if implementation is not a graph", () => {
    const containerSpec: ComponentSpec = {
      name: "container",
      inputs: [],
      outputs: [],
      implementation: {
        container: {
          image: "test-image",
        },
      },
    };

    const result = unpackSubgraph("subgraph-task", containerSpec);

    expect(result).toBe(containerSpec);
    expect(unpackInputs).not.toHaveBeenCalled();
  });

  it("should return unchanged spec if subgraph spec is undefined", () => {
    const containerSpec = createMockComponentSpec({
      "subgraph-task": {
        componentRef: {},
        annotations: {},
      } as TaskSpec,
    });

    const result = unpackSubgraph("subgraph-task", containerSpec);

    expect(result).toBe(containerSpec);
    expect(unpackInputs).not.toHaveBeenCalled();
  });

  it("should return unchanged spec if subgraph implementation is not a graph", () => {
    const subgraphSpec: ComponentSpec = {
      name: "subgraph",
      inputs: [],
      outputs: [],
      implementation: {
        container: {
          image: "test-image",
        },
      },
    };

    const containerSpec = createMockComponentSpec({
      "subgraph-task": createMockTaskSpec(subgraphSpec),
    });

    const result = unpackSubgraph("subgraph-task", containerSpec);

    expect(result).toBe(containerSpec);
    expect(unpackInputs).not.toHaveBeenCalled();
  });

  it("should unpack a simple subgraph with no external connections", () => {
    const subgraphSpec = createMockComponentSpec(
      {
        "internal-task": createMockTaskSpec(
          createMockComponentSpec(),
          {},
          { "editor.position": JSON.stringify({ x: 50, y: 50 }) },
        ),
      },
      {},
      [{ name: "input1", type: "String" }],
      [{ name: "output1", type: "String" }],
    );

    const containerSpec = createMockComponentSpec({
      "subgraph-task": createMockTaskSpec(subgraphSpec),
    });

    const mockAfterInputs = createMockComponentSpec();
    const mockAfterOutputs = createMockComponentSpec();
    const mockAfterTasks = createMockComponentSpec();
    const mockAfterCopyOutputs = createMockComponentSpec();
    const mockAfterReconnectUpstream = createMockComponentSpec();
    const mockAfterReconnectDownstreamOutputs = createMockComponentSpec();
    const mockFinal = createMockComponentSpec();

    vi.mocked(unpackInputs).mockReturnValue({
      spec: mockAfterInputs,
      inputNameMap: new Map(),
    });
    vi.mocked(unpackOutputs).mockReturnValue({
      spec: mockAfterOutputs,
      outputNameMap: new Map(),
    });
    vi.mocked(unpackTasks).mockReturnValue({
      spec: mockAfterTasks,
      taskIdMap: new Map(),
    });
    vi.mocked(copyOutputValues).mockReturnValue(mockAfterCopyOutputs);
    vi.mocked(reconnectUpstreamInputsAndTasks).mockReturnValue(
      mockAfterReconnectUpstream,
    );
    vi.mocked(reconnectDownstreamOutputs).mockReturnValue(
      mockAfterReconnectDownstreamOutputs,
    );
    vi.mocked(reconnectDownstreamTasks).mockReturnValue(mockFinal);

    const result = unpackSubgraph("subgraph-task", containerSpec);

    expect(result).toBe(mockFinal);
    expect(unpackInputs).toHaveBeenCalledWith(
      subgraphSpec,
      mockPosition,
      {},
      containerSpec,
    );
    expect(unpackOutputs).toHaveBeenCalledWith(
      subgraphSpec,
      mockPosition,
      mockAfterInputs,
      {},
      {},
    );
    expect(unpackTasks).toHaveBeenCalledWith(
      subgraphSpec,
      mockPosition,
      mockAfterOutputs,
      expect.any(Map),
    );
    expect(copyOutputValues).toHaveBeenCalledWith(
      subgraphSpec,
      mockAfterTasks,
      expect.any(Map),
      expect.any(Map),
      {},
      {},
    );
    expect(reconnectUpstreamInputsAndTasks).toHaveBeenCalled();
    expect(reconnectDownstreamOutputs).toHaveBeenCalled();
    expect(reconnectDownstreamTasks).toHaveBeenCalled();
  });

  it("should pass subgraph arguments to unpackInputs", () => {
    const subgraphSpec = createMockComponentSpec({}, {}, [
      { name: "input1", type: "String" },
    ]);

    const subgraphArgs = {
      input1: "static-value",
    };

    const containerSpec = createMockComponentSpec({
      "subgraph-task": createMockTaskSpec(subgraphSpec, subgraphArgs),
    });

    vi.mocked(unpackInputs).mockReturnValue({
      spec: createMockComponentSpec(),
      inputNameMap: new Map(),
    });
    vi.mocked(unpackOutputs).mockReturnValue({
      spec: createMockComponentSpec(),
      outputNameMap: new Map(),
    });
    vi.mocked(unpackTasks).mockReturnValue({
      spec: createMockComponentSpec(),
      taskIdMap: new Map(),
    });
    vi.mocked(copyOutputValues).mockReturnValue(createMockComponentSpec());
    vi.mocked(reconnectUpstreamInputsAndTasks).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamOutputs).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamTasks).mockReturnValue(
      createMockComponentSpec(),
    );

    unpackSubgraph("subgraph-task", containerSpec);

    expect(unpackInputs).toHaveBeenCalledWith(
      subgraphSpec,
      mockPosition,
      subgraphArgs,
      containerSpec,
    );
  });

  it("should handle subgraph with external output connections", () => {
    const subgraphSpec = createMockComponentSpec(
      {},
      { output1: createTaskOutputArgument("internal-task", "out") },
      [],
      [{ name: "output1", type: "String" }],
    );

    const containerSpec = createMockComponentSpec({
      "subgraph-task": createMockTaskSpec(subgraphSpec),
    });

    const mockOutputConnections = {
      "graph-output": createTaskOutputArgument("subgraph-task", "output1"),
    };

    vi.mocked(getOutputNodesConnectedToTask).mockReturnValue(
      mockOutputConnections,
    );
    vi.mocked(unpackInputs).mockReturnValue({
      spec: createMockComponentSpec(),
      inputNameMap: new Map(),
    });
    vi.mocked(unpackOutputs).mockReturnValue({
      spec: createMockComponentSpec(),
      outputNameMap: new Map(),
    });
    vi.mocked(unpackTasks).mockReturnValue({
      spec: createMockComponentSpec(),
      taskIdMap: new Map(),
    });
    vi.mocked(copyOutputValues).mockReturnValue(createMockComponentSpec());
    vi.mocked(reconnectUpstreamInputsAndTasks).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamOutputs).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamTasks).mockReturnValue(
      createMockComponentSpec(),
    );

    unpackSubgraph("subgraph-task", containerSpec);

    expect(unpackOutputs).toHaveBeenCalledWith(
      subgraphSpec,
      mockPosition,
      expect.any(Object),
      mockOutputConnections,
      {},
    );
    expect(copyOutputValues).toHaveBeenCalledWith(
      subgraphSpec,
      expect.any(Object),
      expect.any(Map),
      expect.any(Map),
      mockOutputConnections,
      {},
    );
  });

  it("should handle subgraph with downstream task connections", () => {
    const subgraphSpec = createMockComponentSpec(
      {},
      { output1: createTaskOutputArgument("internal-task", "out") },
      [],
      [{ name: "output1", type: "String" }],
    );

    const containerSpec = createMockComponentSpec({
      "subgraph-task": createMockTaskSpec(subgraphSpec),
      "downstream-task": createMockTaskSpec(createMockComponentSpec(), {
        input: createTaskOutputArgument("subgraph-task", "output1"),
      }),
    });

    const mockDownstreamConnections = {
      "downstream-task": {
        input: createTaskOutputArgument("subgraph-task", "output1"),
      },
    };

    vi.mocked(getDownstreamTaskNodesConnectedToTask).mockReturnValue(
      mockDownstreamConnections,
    );
    vi.mocked(unpackInputs).mockReturnValue({
      spec: createMockComponentSpec(),
      inputNameMap: new Map(),
    });
    vi.mocked(unpackOutputs).mockReturnValue({
      spec: createMockComponentSpec(),
      outputNameMap: new Map(),
    });
    vi.mocked(unpackTasks).mockReturnValue({
      spec: createMockComponentSpec(),
      taskIdMap: new Map(),
    });
    vi.mocked(copyOutputValues).mockReturnValue(createMockComponentSpec());
    vi.mocked(reconnectUpstreamInputsAndTasks).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamOutputs).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamTasks).mockReturnValue(
      createMockComponentSpec(),
    );

    unpackSubgraph("subgraph-task", containerSpec);

    expect(unpackOutputs).toHaveBeenCalledWith(
      subgraphSpec,
      mockPosition,
      expect.any(Object),
      {},
      mockDownstreamConnections,
    );
    expect(copyOutputValues).toHaveBeenCalledWith(
      subgraphSpec,
      expect.any(Object),
      expect.any(Map),
      expect.any(Map),
      {},
      mockDownstreamConnections,
    );
  });

  it("should extract position from subgraph task annotations", () => {
    const customPosition = { x: 200, y: 300 };
    const subgraphSpec = createMockComponentSpec();

    const containerSpec = createMockComponentSpec({
      "subgraph-task": createMockTaskSpec(
        subgraphSpec,
        {},
        {
          "editor.position": JSON.stringify(customPosition),
        },
      ),
    });

    vi.mocked(extractPositionFromAnnotations).mockReturnValue(customPosition);
    vi.mocked(unpackInputs).mockReturnValue({
      spec: createMockComponentSpec(),
      inputNameMap: new Map(),
    });
    vi.mocked(unpackOutputs).mockReturnValue({
      spec: createMockComponentSpec(),
      outputNameMap: new Map(),
    });
    vi.mocked(unpackTasks).mockReturnValue({
      spec: createMockComponentSpec(),
      taskIdMap: new Map(),
    });
    vi.mocked(copyOutputValues).mockReturnValue(createMockComponentSpec());
    vi.mocked(reconnectUpstreamInputsAndTasks).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamOutputs).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamTasks).mockReturnValue(
      createMockComponentSpec(),
    );

    unpackSubgraph("subgraph-task", containerSpec);

    expect(extractPositionFromAnnotations).toHaveBeenCalledWith({
      "editor.position": JSON.stringify(customPosition),
    });
    expect(unpackInputs).toHaveBeenCalledWith(
      subgraphSpec,
      customPosition,
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("should pass taskIdMap through all reconnection functions", () => {
    const subgraphSpec = createMockComponentSpec();
    const containerSpec = createMockComponentSpec({
      "subgraph-task": createMockTaskSpec(subgraphSpec),
    });

    const mockTaskIdMap = new Map([
      ["internal-task-1", "internal-task-1-new"],
      ["internal-task-2", "internal-task-2-new"],
    ]);

    vi.mocked(unpackInputs).mockReturnValue({
      spec: createMockComponentSpec(),
      inputNameMap: new Map(),
    });
    vi.mocked(unpackOutputs).mockReturnValue({
      spec: createMockComponentSpec(),
      outputNameMap: new Map(),
    });
    vi.mocked(unpackTasks).mockReturnValue({
      spec: createMockComponentSpec(),
      taskIdMap: mockTaskIdMap,
    });
    vi.mocked(copyOutputValues).mockReturnValue(createMockComponentSpec());
    vi.mocked(reconnectUpstreamInputsAndTasks).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamOutputs).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamTasks).mockReturnValue(
      createMockComponentSpec(),
    );

    unpackSubgraph("subgraph-task", containerSpec);

    expect(copyOutputValues).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.any(Map),
      mockTaskIdMap,
      expect.any(Object),
      expect.any(Object),
    );
    expect(reconnectUpstreamInputsAndTasks).toHaveBeenCalledWith(
      expect.any(Object),
      "subgraph-task",
      expect.any(Object),
      expect.any(Object),
      mockTaskIdMap,
    );
    expect(reconnectDownstreamOutputs).toHaveBeenCalledWith(
      expect.any(Object),
      "subgraph-task",
      expect.any(Object),
      expect.any(Object),
      mockTaskIdMap,
    );
    expect(reconnectDownstreamTasks).toHaveBeenCalledWith(
      expect.any(Object),
      "subgraph-task",
      expect.any(Object),
      expect.any(Object),
      mockTaskIdMap,
    );
  });

  it("should call helper functions in correct order", () => {
    const subgraphSpec = createMockComponentSpec();
    const containerSpec = createMockComponentSpec({
      "subgraph-task": createMockTaskSpec(subgraphSpec),
    });

    const callOrder: string[] = [];

    vi.mocked(unpackInputs).mockImplementation(() => {
      callOrder.push("unpackInputs");
      return { spec: createMockComponentSpec(), inputNameMap: new Map() };
    });
    vi.mocked(unpackOutputs).mockImplementation(() => {
      callOrder.push("unpackOutputs");
      return { spec: createMockComponentSpec(), outputNameMap: new Map() };
    });
    vi.mocked(unpackTasks).mockImplementation(() => {
      callOrder.push("unpackTasks");
      return { spec: createMockComponentSpec(), taskIdMap: new Map() };
    });
    vi.mocked(copyOutputValues).mockImplementation(() => {
      callOrder.push("copyOutputValues");
      return createMockComponentSpec();
    });
    vi.mocked(reconnectUpstreamInputsAndTasks).mockImplementation(() => {
      callOrder.push("reconnectUpstreamInputsAndTasks");
      return createMockComponentSpec();
    });
    vi.mocked(reconnectDownstreamOutputs).mockImplementation(() => {
      callOrder.push("reconnectDownstreamOutputs");
      return createMockComponentSpec();
    });
    vi.mocked(reconnectDownstreamTasks).mockImplementation(() => {
      callOrder.push("reconnectDownstreamTasks");
      return createMockComponentSpec();
    });

    unpackSubgraph("subgraph-task", containerSpec);

    expect(callOrder).toEqual([
      "unpackInputs",
      "unpackOutputs",
      "unpackTasks",
      "copyOutputValues",
      "reconnectUpstreamInputsAndTasks",
      "reconnectDownstreamOutputs",
      "reconnectDownstreamTasks",
    ]);
  });

  it("should handle subgraph with empty arguments", () => {
    const subgraphSpec = createMockComponentSpec({}, {}, [
      { name: "input1", type: "String" },
    ]);

    const containerSpec = createMockComponentSpec({
      "subgraph-task": createMockTaskSpec(subgraphSpec),
    });

    vi.mocked(unpackInputs).mockReturnValue({
      spec: createMockComponentSpec(),
      inputNameMap: new Map(),
    });
    vi.mocked(unpackOutputs).mockReturnValue({
      spec: createMockComponentSpec(),
      outputNameMap: new Map(),
    });
    vi.mocked(unpackTasks).mockReturnValue({
      spec: createMockComponentSpec(),
      taskIdMap: new Map(),
    });
    vi.mocked(copyOutputValues).mockReturnValue(createMockComponentSpec());
    vi.mocked(reconnectUpstreamInputsAndTasks).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamOutputs).mockReturnValue(
      createMockComponentSpec(),
    );
    vi.mocked(reconnectDownstreamTasks).mockReturnValue(
      createMockComponentSpec(),
    );

    unpackSubgraph("subgraph-task", containerSpec);

    expect(unpackInputs).toHaveBeenCalledWith(
      subgraphSpec,
      mockPosition,
      {},
      containerSpec,
    );
  });
});
