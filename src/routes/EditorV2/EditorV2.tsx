import { DndContext } from "@dnd-kit/core";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  Background,
  MiniMap,
  ReactFlow,
  type ReactFlowProps,
  ReactFlowProvider,
} from "@xyflow/react";
import { type ComponentType, useState } from "react";
import { proxy, useSnapshot } from "valtio";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpecEntity } from "@/providers/ComponentSpec/componentSpec";
import {
  GraphImplementation,
  type TasksCollection,
} from "@/providers/ComponentSpec/graphImplementation";
import { YamlLoader } from "@/providers/ComponentSpec/yamlLoader";

import { TaskNode } from "./components/TaskNode";

const GRID_SIZE = 10;

const availableTemplates = import.meta.glob<string>("./assets/*.yaml", {
  query: "?raw",
  import: "default",
});

async function getSpecByName(name: "test-spec") {
  return availableTemplates[`./assets/${name}.yaml`]();
}

function useExperimentalFlow() {
  const [yamlLoader] = useState(() => new YamlLoader());

  /**
   * Load the test spec from the assets folder.
   */
  const { data: testSpecText } = useSuspenseQuery({
    queryKey: ["test-spec"],
    queryFn: () => getSpecByName("test-spec"),
    staleTime: Infinity,
    retry: false,
  });

  const { data: testSpec } = useSuspenseQuery({
    queryKey: ["test-spec-entity"],
    queryFn: () => yamlLoader.loadFromText(testSpecText),
    staleTime: Infinity,
    retry: false,
  });

  return proxy(testSpec);
}

function isGraphImplementation(
  implementation: ComponentSpecEntity["implementation"],
): implementation is GraphImplementation {
  return (
    implementation !== undefined &&
    implementation !== null &&
    implementation instanceof GraphImplementation
  );
}

const PipelineEditorCanvas = withSuspenseWrapper(() => {
  const experimentalFlow = useExperimentalFlow();

  const [flowConfig] = useState<ReactFlowProps>({
    snapGrid: [GRID_SIZE, GRID_SIZE],
    snapToGrid: true,
    panOnDrag: true,
    selectionOnDrag: false,
    nodesDraggable: true,
  });

  // todo: convert experimentalFlow to nodes and edges
  console.log(experimentalFlow);

  if (!isGraphImplementation(experimentalFlow.implementation)) {
    return null;
  }

  return (
    <InlineStack fill blockAlign="start">
      <BlockStack fill className="flex-1 border border-red-500">
        <FlowCanvas
          {...flowConfig}
          tasks={experimentalFlow.implementation.tasks}
        ></FlowCanvas>
      </BlockStack>
      <BlockStack
        fill
        className="w-[300px] border border-blue-500"
        inlineAlign="start"
      >
        <Text>Debug info here</Text>
      </BlockStack>
    </InlineStack>
  );
});

export function EditorV2() {
  return (
    <BlockStack className="h-screen w-screen">
      <Heading level={1}>Editor V2</Heading>
      <Paragraph>This is the new editor. It is still in development.</Paragraph>
      <div className="dndflow h-full w-full">
        <DndContext>
          <ReactFlowProvider>
            <PipelineEditorCanvas />
          </ReactFlowProvider>
        </DndContext>
      </div>
    </BlockStack>
  );
}

const nodeTypes: Record<string, ComponentType<any>> = {
  task: TaskNode,
};

function FlowCanvas({
  children,
  nodes,
  edges,
  tasks,
  ...rest
}: ReactFlowProps & { tasks: TasksCollection }) {
  const tasksSnapshot = useSnapshot(tasks);

  const allNodes = [
    ...(tasksSnapshot.getAll().map((task, index) => ({
      id: task.$id,
      type: "task",
      position: { x: index * 100, y: index * 100 },
      data: {
        name: task.name,
        description: task.componentRef.spec?.description ?? "",
      },
    })) ?? []),
  ];

  return (
    <BlockStack className="h-full w-full">
      <ReactFlow
        {...rest}
        nodes={allNodes}
        edges={edges}
        minZoom={0.01}
        maxZoom={3}
        // onNodesChange={handleOnNodesChange}
        // onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        // edgeTypes={edgeTypes}
        // onConnect={onConnect}
        // onConnectEnd={onConnectEnd}
        // onDragOver={onDragOver}
        // onDrop={onDrop}
        // onPaneClick={onPaneClick}
        // onBeforeDelete={handleBeforeDelete}
        // onDelete={onElementsRemove}
        // onInit={onInit}
        // deleteKeyCode={["Delete", "Backspace"]}
        // onSelectionChange={handleSelectionChange}
        // onSelectionEnd={handleSelectionEnd}
        // nodesConnectable={readOnly ? false : nodesConnectable}
        // connectOnClick={!readOnly}
        className={cn(rest.selectionOnDrag && "cursor-crosshair")}
      >
        {children}
        <MiniMap position="bottom-left" pannable />

        <Background gap={GRID_SIZE} className="bg-slate-50!" />
      </ReactFlow>
    </BlockStack>
  );
}
