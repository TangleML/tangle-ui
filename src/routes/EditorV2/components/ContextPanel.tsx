import type { ChangeEvent } from "react";
import { useSnapshot } from "valtio";

import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { GraphImplementation } from "@/providers/ComponentSpec/graphImplementation";

import { renameInput, renameOutput, renameTask } from "../store/actions";
import { editorStore } from "../store/editorStore";
import { MultiSelectionDetails } from "./MultiSelectionDetails";
import { TaskAnnotationsEditor } from "./TaskAnnotationsEditor";

/**
 * Content for the Context Panel window.
 * Displays details about the selected node and allows editing via direct mutation.
 * Used within the Windows system.
 */
export function ContextPanelContent() {
  const snapshot = useSnapshot(editorStore);
  const { selectedNodeId, selectedNodeType, spec, multiSelection } = snapshot;

  // Multi-selection takes priority
  if (multiSelection.length > 1) {
    return <MultiSelectionDetails />;
  }

  if (!selectedNodeId || !selectedNodeType || !spec) {
    return <EmptyState />;
  }

  return (
    <BlockStack className="h-full bg-white overflow-y-auto">
      {selectedNodeType === "task" && <TaskDetails entityId={selectedNodeId} />}
      {selectedNodeType === "input" && (
        <InputDetails entityId={selectedNodeId} />
      )}
      {selectedNodeType === "output" && (
        <OutputDetails entityId={selectedNodeId} />
      )}
    </BlockStack>
  );
}

/**
 * @deprecated Use ContextPanelContent within the Windows system instead.
 * Kept for backwards compatibility.
 */
export function ContextPanel() {
  return (
    <BlockStack className="h-full w-[280px] border-l border-gray-200 bg-white overflow-y-auto">
      <ContextPanelContent />
    </BlockStack>
  );
}

function EmptyState() {
  return (
    <BlockStack className="h-full items-center justify-center p-4">
      <Icon name="MousePointerClick" size="lg" className="text-gray-300" />
      <Text size="sm" tone="subdued" className="text-center mt-2">
        Select a node to view details
      </Text>
    </BlockStack>
  );
}

interface TaskDetailsProps {
  entityId: string;
}

function TaskDetails({ entityId }: TaskDetailsProps) {
  const snapshot = useSnapshot(editorStore);
  const spec = snapshot.spec;

  if (
    !spec?.implementation ||
    !(spec.implementation instanceof GraphImplementation)
  ) {
    return null;
  }

  // Get task directly from entities using $id
  const task = spec.implementation.tasks.entities[entityId];
  if (!task) {
    return null;
  }

  const componentSpec = task.componentRef.spec;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== task.name) {
      renameTask(entityId, newName);
      console.log("task renamed 1", newName);
    }
  };

  return (
    <BlockStack>
     

      <BlockStack gap="4" className="p-3">
        <BlockStack gap="2">
          <Label htmlFor="task-name" className="text-gray-600">
            Name
          </Label>
          <Input
            key={entityId}
            id="task-name"
            defaultValue={task.name}
            onBlur={handleNameChange}
            className="font-mono text-sm"
          />
        </BlockStack>

        {componentSpec?.description && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Description</Label>
            <Text size="sm" className="text-gray-500">
              {componentSpec.description}
            </Text>
          </BlockStack>
        )}

        <Separator />

        {componentSpec?.inputs && componentSpec.inputs.length > 0 && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Inputs</Label>
            <BlockStack gap="1">
              {componentSpec.inputs.map((input) => (
                <InlineStack
                  key={input.name}
                  gap="2"
                  className="text-xs py-1 px-2 bg-gray-50 rounded border border-gray-100"
                >
                  <Text size="xs" weight="semibold" className="text-gray-700">
                    {input.name}
                  </Text>
                  {input.type && (
                    <Text size="xs" className="text-gray-500">
                      : {String(input.type)}
                    </Text>
                  )}
                  {input.optional && (
                    <Text size="xs" className="text-gray-400 italic">
                      (optional)
                    </Text>
                  )}
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        )}

        {componentSpec?.outputs && componentSpec.outputs.length > 0 && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Outputs</Label>
            <BlockStack gap="1">
              {componentSpec.outputs.map((output) => (
                <InlineStack
                  key={output.name}
                  gap="2"
                  className="text-xs py-1 px-2 bg-gray-50 rounded border border-gray-100"
                >
                  <Text size="xs" weight="semibold" className="text-gray-700">
                    {output.name}
                  </Text>
                  {output.type && (
                    <Text size="xs" className="text-gray-500">
                      : {String(output.type)}
                    </Text>
                  )}
                </InlineStack>
              ))}
            </BlockStack>
          </BlockStack>
        )}

        <TaskAnnotationsEditor entityId={entityId} />
      </BlockStack>
    </BlockStack>
  );
}

interface InputDetailsProps {
  entityId: string;
}

function InputDetails({ entityId }: InputDetailsProps) {
  const snapshot = useSnapshot(editorStore);
  const spec = snapshot.spec;
  if (!spec) return null;

  // Get input directly from entities using $id
  const input = spec.inputs.entities[entityId];
  if (!input) return null;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== input.name) {
      renameInput(entityId, newName);
    }
  };

  return (
    <BlockStack>
      <PanelHeader
        icon="Download"
        iconClassName="text-blue-500"
        title="Graph Input"
      />

      <BlockStack gap="4" className="p-3">
        <BlockStack gap="2">
          <Label htmlFor="input-name" className="text-gray-600">
            Name
          </Label>
          <Input
            key={entityId}
            id="input-name"
            defaultValue={input.name}
            onBlur={handleNameChange}
            className="font-mono text-sm"
          />
        </BlockStack>

        {input.type && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Type</Label>
            <Text size="sm" className="font-mono text-gray-500">
              {String(input.type)}
            </Text>
          </BlockStack>
        )}

        {input.description && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Description</Label>
            <Text size="sm" className="text-gray-500">
              {input.description}
            </Text>
          </BlockStack>
        )}

        {input.default !== undefined && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Default Value</Label>
            <Text size="sm" className="font-mono text-gray-500">
              {input.default}
            </Text>
          </BlockStack>
        )}

        <InlineStack gap="2">
          <Text size="xs" className="text-gray-400">
            Optional:
          </Text>
          <Text size="xs" weight="semibold" className="text-gray-600">
            {input.optional ? "Yes" : "No"}
          </Text>
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
}

interface OutputDetailsProps {
  entityId: string;
}

function OutputDetails({ entityId }: OutputDetailsProps) {
  const snapshot = useSnapshot(editorStore);
  const spec = snapshot.spec;
  if (!spec) return null;

  // Get output directly from entities using $id
  const output = spec.outputs.entities[entityId];
  if (!output) return null;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== output.name) {
      renameOutput(entityId, newName);
    }
  };

  return (
    <BlockStack>
      <PanelHeader
        icon="Upload"
        iconClassName="text-green-500"
        title="Graph Output"
      />

      <BlockStack gap="4" className="p-3">
        <BlockStack gap="2">
          <Label htmlFor="output-name" className="text-gray-600">
            Name
          </Label>
          <Input
            key={entityId}
            id="output-name"
            defaultValue={output.name}
            onBlur={handleNameChange}
            className="font-mono text-sm"
          />
        </BlockStack>

        {output.type && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Type</Label>
            <Text size="sm" className="font-mono text-gray-500">
              {String(output.type)}
            </Text>
          </BlockStack>
        )}

        {output.description && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Description</Label>
            <Text size="sm" className="text-gray-500">
              {output.description}
            </Text>
          </BlockStack>
        )}
      </BlockStack>
    </BlockStack>
  );
}

interface PanelHeaderProps {
  icon: string;
  iconClassName?: string;
  title: string;
}

function PanelHeader({ icon, iconClassName, title }: PanelHeaderProps) {
  return (
    <InlineStack
      gap="2"
      blockAlign="center"
      className="p-3 border-b border-gray-200 bg-gray-50"
    >
      <Icon
        name={icon as any}
        size="sm"
        className={cn("shrink-0", iconClassName)}
      />
      <Text size="sm" weight="semibold" className="text-gray-700">
        {title}
      </Text>
    </InlineStack>
  );
}
