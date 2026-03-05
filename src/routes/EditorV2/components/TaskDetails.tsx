import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpecJson } from "@/models/componentSpec";

import { useSpec } from "../providers/SpecContext";
import { renameTask } from "../store/actions";
import { editorStore } from "../store/editorStore";
import { ConfigurationSection } from "./ConfigurationSection";
import { TaskAnnotationsEditor } from "./TaskAnnotationsEditor";
import { TaskArgumentsEditor } from "./TaskArgumentsEditor";

interface TaskDetailsProps {
  entityId: string;
}

export const TaskDetails = observer(function TaskDetails({
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
      className="w-full overflow-hidden"
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

      <AccordionItem value="configuration">
        <AccordionTrigger className="py-1.5 px-3 text-xs hover:no-underline">
          <Text
            size="xs"
            weight="semibold"
            className="uppercase tracking-wide text-gray-500"
          >
            Configuration
          </Text>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-2">
          <ConfigurationSection task={task} />
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
