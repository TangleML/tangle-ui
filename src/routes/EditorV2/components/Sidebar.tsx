import type { DragEvent } from "react";

import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentReference, TaskSpec } from "@/utils/componentSpec";

/**
 * Hardcoded sample components for the MVP.
 * In a real implementation, these would come from a component library.
 */
const SAMPLE_COMPONENTS: ComponentReference[] = [
  {
    name: "Data Loader",
    digest: "sample-data-loader",
    spec: {
      name: "Data Loader",
      description: "Loads data from a source",
      inputs: [
        {
          name: "source_url",
          type: "String",
          description: "URL of the data source",
        },
        { name: "format", type: "String", default: "csv", optional: true },
      ],
      outputs: [{ name: "data", type: "Dataset", description: "Loaded data" }],
      implementation: {
        container: {
          image: "python:3.10",
          command: ["python", "-c", "print('Loading data...')"],
        },
      },
    },
  },
  {
    name: "Data Transform",
    digest: "sample-data-transform",
    spec: {
      name: "Data Transform",
      description: "Transforms input data",
      inputs: [
        { name: "input_data", type: "Dataset" },
        { name: "transform_type", type: "String", default: "normalize" },
      ],
      outputs: [{ name: "transformed_data", type: "Dataset" }],
      implementation: {
        container: {
          image: "python:3.10",
          command: ["python", "-c", "print('Transforming...')"],
        },
      },
    },
  },
  {
    name: "Model Trainer",
    digest: "sample-model-trainer",
    spec: {
      name: "Model Trainer",
      description: "Trains a machine learning model",
      inputs: [
        { name: "training_data", type: "Dataset" },
        { name: "model_type", type: "String", default: "linear" },
        { name: "epochs", type: "Integer", default: "10", optional: true },
      ],
      outputs: [
        { name: "model", type: "Model" },
        { name: "metrics", type: "Metrics" },
      ],
      implementation: {
        container: {
          image: "python:3.10",
          command: ["python", "-c", "print('Training...')"],
        },
      },
    },
  },
  {
    name: "Model Predictor",
    digest: "sample-model-predictor",
    spec: {
      name: "Model Predictor",
      description: "Makes predictions using a trained model",
      inputs: [
        { name: "model", type: "Model" },
        { name: "input_data", type: "Dataset" },
      ],
      outputs: [{ name: "predictions", type: "Dataset" }],
      implementation: {
        container: {
          image: "python:3.10",
          command: ["python", "-c", "print('Predicting...')"],
        },
      },
    },
  },
];

interface DraggableItemProps {
  children: React.ReactNode;
  onDragStart: (event: DragEvent) => void;
  className?: string;
}

function DraggableItem({
  children,
  onDragStart,
  className,
}: DraggableItemProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={cn(
        "px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing",
        "hover:bg-slate-100 active:bg-slate-200 transition-colors",
        "border border-transparent hover:border-slate-200",
        className,
      )}
    >
      {children}
    </div>
  );
}

interface ComponentItemProps {
  component: ComponentReference;
}

function ComponentItem({ component }: ComponentItemProps) {
  const handleDragStart = (event: DragEvent) => {
    const taskSpec: TaskSpec = {
      componentRef: component,
    };

    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({ task: taskSpec }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <DraggableItem onDragStart={handleDragStart}>
      <InlineStack gap="2" blockAlign="center">
        <Icon name="Workflow" size="sm" className="text-blue-500 shrink-0" />
        <BlockStack gap="0">
          <Text size="sm" weight="semibold" className="text-slate-800">
            {component.name ?? component.spec?.name ?? "Unknown"}
          </Text>
          {component.spec?.description && (
            <Text size="xs" tone="subdued" className="truncate max-w-[180px]">
              {component.spec.description}
            </Text>
          )}
        </BlockStack>
      </InlineStack>
    </DraggableItem>
  );
}

interface IOItemProps {
  type: "input" | "output";
}

function IOItem({ type }: IOItemProps) {
  const handleDragStart = (event: DragEvent) => {
    event.dataTransfer.setData(
      "application/reactflow",
      JSON.stringify({ [type]: null }),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  const isInput = type === "input";

  return (
    <DraggableItem onDragStart={handleDragStart}>
      <InlineStack gap="2" blockAlign="center">
        <Icon
          name={isInput ? "Download" : "Upload"}
          size="sm"
          className={cn(
            "shrink-0",
            isInput ? "text-blue-500" : "text-green-500",
          )}
        />
        <Text size="sm" weight="semibold" className="text-slate-800">
          {isInput ? "Graph Input" : "Graph Output"}
        </Text>
      </InlineStack>
    </DraggableItem>
  );
}

export function Sidebar() {
  return (
    <BlockStack className="h-full w-[260px] border-r border-slate-200 bg-white overflow-y-auto">
      <BlockStack className="p-3 border-b border-slate-100">
        <Text
          size="sm"
          weight="semibold"
          className="text-slate-600 uppercase tracking-wide"
        >
          Inputs & Outputs
        </Text>
      </BlockStack>

      <BlockStack gap="1" className="p-2">
        <IOItem type="input" />
        <IOItem type="output" />
      </BlockStack>

      <Separator />

      <BlockStack className="p-3 border-b border-slate-100">
        <Text
          size="sm"
          weight="semibold"
          className="text-slate-600 uppercase tracking-wide"
        >
          Sample Components
        </Text>
        <Text size="xs" tone="subdued">
          Drag components to the canvas
        </Text>
      </BlockStack>

      <BlockStack gap="1" className="p-2">
        {SAMPLE_COMPONENTS.map((component) => (
          <ComponentItem key={component.digest} component={component} />
        ))}
      </BlockStack>
    </BlockStack>
  );
}
