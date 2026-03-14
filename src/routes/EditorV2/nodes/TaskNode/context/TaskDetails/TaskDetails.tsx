import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useState } from "react";

import { ActionBlock } from "@/components/shared/ContextPanel/Blocks/ActionBlock";
import { DeleteComponentButton } from "@/components/shared/TaskDetails/Actions/DeleteComponentButton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ColorPicker } from "@/components/ui/color";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import type { ComponentSpecJson } from "@/models/componentSpec";
import { componentSpecToText } from "@/utils/yaml";

import { AnnotationsBlock } from "../../../../components/AnnotationsBlock/AnnotationsBlock";
import { useSpec } from "../../../../providers/SpecContext";
import {
  deleteTask,
  duplicateSelectedNodes,
  renameTask,
} from "../../../../store/actions";
import { editorStore } from "../../../../store/editorStore";
import { CopyYamlButton } from "./components/actions/CopyYamlButton";
import { DownloadPythonButton } from "./components/actions/DownloadPythonButton";
import { DownloadYamlButton } from "./components/actions/DownloadYamlButton";
import { DuplicateTaskButton } from "./components/actions/DuplicateTaskButton";
import { EditComponentButton } from "./components/actions/EditComponentButton";
import { ViewTaskYamlButton } from "./components/actions/ViewTaskYamlButton";
import { ConfigurationSection } from "./components/ConfigurationSection";
import { TaskArgumentsEditor } from "./components/TaskArgumentsEditor";
import { setTaskColor } from "./components/taskConfig.actions";

const EDITOR_ANNOTATION_KEYS = [
  "editor.position",
  "tangleml.com/editor/task-color",
  "tangleml.com/editor/edge-conduits",
];

interface TaskDetailsProps {
  entityId: string;
}

export const TaskDetails = observer(function TaskDetails({
  entityId,
}: TaskDetailsProps) {
  const spec = useSpec();
  const task = spec?.tasks.find((t) => t.$id === entityId);
  const { focusedArgumentName } = editorStore;

  const [openSections, setOpenSections] = useState<string[]>([
    "task",
    "arguments",
  ]);

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
    (a) => !EDITOR_ANNOTATION_KEYS.includes(a.key),
  ).length;
  const taskColor = task.annotations.get("tangleml.com/editor/task-color");

  const yamlText =
    task.componentRef.text ??
    (componentSpec
      ? componentSpecToText(
          componentSpec as Parameters<typeof componentSpecToText>[0],
        )
      : "");
  const pythonCode = componentSpec?.metadata?.annotations
    ?.python_original_code as string | undefined;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== task.name) {
      renameTask(spec, entityId, newName);
    }
  };

  const handleColorChange = (color: string) => {
    setTaskColor(task, color);
  };

  const handleDuplicate = () => {
    const position = task.annotations.get("editor.position") ?? {
      x: 0,
      y: 0,
    };
    duplicateSelectedNodes(spec, [{ id: entityId, type: "task", position }]);
  };

  const handleDelete = () => {
    deleteTask(spec, entityId);
  };

  return (
    <BlockStack gap="0" className="w-full overflow-auto">
      <ActionBlock
        actions={[
          <DownloadYamlButton
            key="download-yaml"
            yamlText={yamlText}
            taskName={task.name}
          />,
          pythonCode && (
            <DownloadPythonButton
              key="download-python"
              pythonCode={pythonCode}
              fileName={`${task.name}.py`}
            />
          ),
          <CopyYamlButton key="copy-yaml" yamlText={yamlText} />,
          <ViewTaskYamlButton
            key="view-yaml"
            yamlText={yamlText}
            taskName={task.name}
          />,
          <EditComponentButton key="edit" yamlText={yamlText} />,
          <DuplicateTaskButton key="duplicate" onDuplicate={handleDuplicate} />,
          <DeleteComponentButton key="delete" onDelete={handleDelete} />,
        ].filter(Boolean)}
        className="px-3 py-2"
      />
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="w-full overflow-auto"
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
                <InlineStack
                  gap="2"
                  blockAlign="center"
                  wrap="nowrap"
                  className="w-full"
                >
                  <ColorPicker
                    title="Task color"
                    color={taskColor}
                    setColor={handleColorChange}
                  />
                  <Input
                    key={`${entityId}-${task.name}`}
                    id="task-name"
                    defaultValue={task.name}
                    onBlur={handleNameChange}
                    className="font-mono text-xs h-7"
                  />
                </InlineStack>
              </BlockStack>

              {componentSpec?.description && (
                <BlockStack gap="1">
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
          <AccordionContent className="pb-2 px-3">
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
            <AnnotationsBlock
              annotations={task.annotations}
              ignoreAnnotationKeys={EDITOR_ANNOTATION_KEYS}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </BlockStack>
  );
});
