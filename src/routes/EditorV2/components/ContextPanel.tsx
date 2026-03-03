import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ComponentSpecJson } from "@/models/componentSpec";

import { useSpec } from "../providers/SpecContext";
import { renameInput, renameOutput, renameTask } from "../store/actions";
import { editorStore } from "../store/editorStore";
import { MultiSelectionDetails } from "./MultiSelectionDetails";
import { TaskAnnotationsEditor } from "./TaskAnnotationsEditor";
import { TaskArgumentsEditor } from "./TaskArgumentsEditor";

/**
 * Content for the Context Panel window.
 * Displays details about the selected node and allows editing via direct mutation.
 * Used within the Windows system.
 */
export const ContextPanelContent = observer(function ContextPanelContent() {
  const { selectedNodeId, selectedNodeType, multiSelection } = editorStore;

  const spec = useSpec();

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
});

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

const TaskDetails = observer(function TaskDetails({
  entityId,
}: TaskDetailsProps) {
  const spec = useSpec();
  const task = spec?.tasks.find((t) => t.$id === entityId);
  const { focusedArgumentName } = editorStore;

  const [openSections, setOpenSections] = useState<string[]>(["task"]);

  useEffect(() => {
    if (focusedArgumentName && !openSections.includes("arguments")) {
      setOpenSections((prev) => [...prev, "arguments"]);
    }
  }, [focusedArgumentName]);

  if (!spec || !task) {
    return null;
  }

  const componentSpec = task.componentRef.spec as ComponentSpecJson | undefined;
  const inputCount = componentSpec?.inputs?.length ?? 0;
  const outputCount = componentSpec?.outputs?.length ?? 0;
  const annotationCount = task.annotations.filter(
    (a) => !a.key.startsWith("editor."),
  ).length;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== task.name) {
      renameTask(spec, entityId, newName);
    }
  };

  return (
    <Accordion
      type="multiple"
      value={openSections}
      onValueChange={setOpenSections}
    >
      <AccordionItem value="task">
        <AccordionTrigger className="py-1.5 px-3 text-xs hover:no-underline">
          <Text
            size="xs"
            weight="semibold"
            className="uppercase tracking-wide text-gray-500"
          >
            Task
          </Text>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-2">
          <BlockStack gap="2">
            <BlockStack gap="1">
              <Label htmlFor="task-name" className="text-gray-600 text-xs">
                Name
              </Label>
              <Input
                key={`${entityId}-${task.name}`}
                id="task-name"
                defaultValue={task.name}
                onBlur={handleNameChange}
                className="font-mono text-xs h-7"
              />
            </BlockStack>

            {componentSpec?.description && (
              <BlockStack gap="1">
                <Label className="text-gray-600 text-xs">Description</Label>
                <Text size="xs" className="text-gray-500">
                  {componentSpec.description}
                </Text>
              </BlockStack>
            )}
          </BlockStack>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="arguments">
        <AccordionTrigger className="py-1.5 px-3 text-xs hover:no-underline">
          <InlineStack gap="2" blockAlign="center">
            <Text
              size="xs"
              weight="semibold"
              className="uppercase tracking-wide text-gray-500"
            >
              Arguments
            </Text>
            {inputCount > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {inputCount}
              </Badge>
            )}
          </InlineStack>
        </AccordionTrigger>
        <AccordionContent className="pb-2">
          <TaskArgumentsEditor task={task} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="outputs">
        <AccordionTrigger className="py-1.5 px-3 text-xs hover:no-underline">
          <InlineStack gap="2" blockAlign="center">
            <Text
              size="xs"
              weight="semibold"
              className="uppercase tracking-wide text-gray-500"
            >
              Outputs
            </Text>
            {outputCount > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {outputCount}
              </Badge>
            )}
          </InlineStack>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-2">
          {componentSpec?.outputs && componentSpec.outputs.length > 0 ? (
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
          ) : (
            <Text size="xs" tone="subdued">
              No outputs defined
            </Text>
          )}
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="annotations">
        <AccordionTrigger className="py-1.5 px-3 text-xs hover:no-underline">
          <InlineStack gap="2" blockAlign="center">
            <Text
              size="xs"
              weight="semibold"
              className="uppercase tracking-wide text-gray-500"
            >
              Annotations
            </Text>
            {annotationCount > 0 && (
              <Badge
                variant="secondary"
                className="text-[10px] px-1.5 py-0 h-4"
              >
                {annotationCount}
              </Badge>
            )}
          </InlineStack>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-2">
          <TaskAnnotationsEditor entityId={entityId} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
});

interface InputDetailsProps {
  entityId: string;
}

const InputDetails = observer(function InputDetails({
  entityId,
}: InputDetailsProps) {
  const spec = useSpec();
  const input = spec?.inputs.find((i) => i.$id === entityId);

  if (!spec || !input) return null;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== input.name) {
      renameInput(spec, entityId, newName);
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
            key={`${entityId}-${input.name}`}
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

        {input.defaultValue !== undefined && (
          <BlockStack gap="2">
            <Label className="text-gray-600">Default Value</Label>
            <Text size="sm" className="font-mono text-gray-500">
              {input.defaultValue}
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
});

interface OutputDetailsProps {
  entityId: string;
}

const OutputDetails = observer(function OutputDetails({
  entityId,
}: OutputDetailsProps) {
  const spec = useSpec();
  const output = spec?.outputs.find((o) => o.$id === entityId);

  if (!spec || !output) return null;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== output.name) {
      renameOutput(spec, entityId, newName);
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
            key={`${entityId}-${output.name}`}
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
});

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
