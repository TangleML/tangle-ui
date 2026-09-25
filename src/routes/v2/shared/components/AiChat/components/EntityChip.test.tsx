import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ComponentSpec } from "@/models/componentSpec";
import { IncrementingIdGenerator } from "@/models/componentSpec/factories/idGenerator";
import { YamlDeserializer } from "@/models/componentSpec/serialization/yamlDeserializer";
import { FLEX_NODES_ANNOTATION } from "@/utils/annotationKeys";

import { EntityChip } from "./EntityChip";

const mocks = vi.hoisted(() => ({
  navigateToEntity: vi.fn(),
  navigation: {
    rootSpec: null as ComponentSpec | null,
    navigationPath: [],
  } as {
    rootSpec: ComponentSpec | null;
    navigationPath: { displayName: string }[];
  },
  mode: "editor" as "editor" | "runView",
}));

vi.mock("@/routes/v2/shared/store/SharedStoreContext", () => ({
  useSharedStores: () => ({ navigation: mocks.navigation }),
}));

vi.mock("@/routes/v2/shared/store/useFocusActions", () => ({
  useFocusActions: () => ({ navigateToEntity: mocks.navigateToEntity }),
}));

vi.mock("@/routes/v2/shared/components/AiChat/AiChatStoreContext", () => ({
  useAiChatMode: () => mocks.mode,
}));

const containerComponent = (name: string) => ({
  name,
  spec: {
    name,
    inputs: [{ name: "path", type: "String" }],
    outputs: [{ name: "table", type: "String" }],
    implementation: { container: { image: `${name}:1` } },
  },
});

const pipelineYaml = {
  name: "RootPipeline",
  implementation: {
    graph: {
      tasks: {
        Preprocess: {
          componentRef: {
            name: "Preprocess",
            spec: {
              name: "Preprocess",
              implementation: {
                graph: {
                  tasks: {
                    Normalize: {
                      componentRef: {
                        name: "Normalize",
                        spec: {
                          name: "Normalize",
                          implementation: {
                            graph: {
                              tasks: {
                                ScaleColumns: {
                                  componentRef:
                                    containerComponent("ScaleColumns"),
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
        Train: { componentRef: containerComponent("Train") },
      },
    },
  },
};

function taskIdByPath(spec: ComponentSpec, ...names: string[]): string {
  let current = spec;
  for (const name of names.slice(0, -1)) {
    const task = current.tasks.find((t) => t.name === name);
    if (!task?.subgraphSpec) throw new Error(`No subgraph named ${name}`);
    current = task.subgraphSpec;
  }
  const leaf = names[names.length - 1];
  const task = current.tasks.find((t) => t.name === leaf);
  if (!task) throw new Error(`No task named ${leaf}`);
  return task.$id;
}

describe("EntityChip", () => {
  let spec: ComponentSpec;

  beforeEach(() => {
    vi.clearAllMocks();
    spec = new YamlDeserializer(new IncrementingIdGenerator()).deserialize(
      pipelineYaml,
    );
    mocks.navigation.rootSpec = spec;
    mocks.navigation.navigationPath = [{ displayName: "RootPipeline" }];
    mocks.mode = "editor";
  });

  afterEach(cleanup);

  it("navigates to a top-level entity with just the root name", async () => {
    const taskId = taskIdByPath(spec, "Train");
    render(<EntityChip entityId={taskId} label="Train" />);

    await userEvent.click(screen.getByRole("button"));

    expect(mocks.navigateToEntity).toHaveBeenCalledWith(
      ["RootPipeline"],
      taskId,
      "task",
    );
  });

  it("prefixes the root name onto the subgraph chain for a nested entity", async () => {
    const taskId = taskIdByPath(
      spec,
      "Preprocess",
      "Normalize",
      "ScaleColumns",
    );
    render(<EntityChip entityId={taskId} label="ScaleColumns" />);

    await userEvent.click(screen.getByRole("button"));

    expect(mocks.navigateToEntity).toHaveBeenCalledWith(
      ["RootPipeline", "Preprocess", "Normalize"],
      taskId,
      "task",
    );
  });

  it("navigates to a sticky note nested inside a subgraph", async () => {
    const preprocess = spec.tasks.find((t) => t.name === "Preprocess");
    if (!preprocess?.subgraphSpec) throw new Error("no Preprocess subgraph");
    preprocess.subgraphSpec.annotations.set(FLEX_NODES_ANNOTATION, [
      {
        id: "flex_1",
        properties: { title: "Careful", content: "", color: "#FFF9C4" },
        metadata: { createdAt: "2026-01-01T00:00:00.000Z", createdBy: "user" },
        size: { width: 150, height: 100 },
        position: { x: 0, y: 0 },
        zIndex: 0,
      },
    ]);

    render(<EntityChip entityId="flex_1" label="Careful" />);

    await userEvent.click(screen.getByRole("button"));

    expect(mocks.navigateToEntity).toHaveBeenCalledWith(
      ["RootPipeline", "Preprocess"],
      "flex_1",
      "flex",
    );
  });

  it("disables the chip for an entity that is not in the pipeline", () => {
    render(<EntityChip entityId="no-such-id" label="Ghost" />);

    expect(screen.getByRole("button")).toBeDisabled();
    expect(mocks.navigateToEntity).not.toHaveBeenCalled();
  });

  it("disables a chip pointing into another subgraph while in RunView", () => {
    mocks.mode = "runView";
    const taskId = taskIdByPath(spec, "Preprocess", "Normalize");
    render(<EntityChip entityId={taskId} label="Normalize" />);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("still navigates within the graph on screen while in RunView", async () => {
    mocks.mode = "runView";
    mocks.navigation.navigationPath = [
      { displayName: "RootPipeline" },
      { displayName: "Preprocess" },
    ];
    const taskId = taskIdByPath(spec, "Preprocess", "Normalize");
    render(<EntityChip entityId={taskId} label="Normalize" />);

    await userEvent.click(screen.getByRole("button"));

    expect(mocks.navigateToEntity).toHaveBeenCalledWith(
      ["RootPipeline", "Preprocess"],
      taskId,
      "task",
    );
  });
});
