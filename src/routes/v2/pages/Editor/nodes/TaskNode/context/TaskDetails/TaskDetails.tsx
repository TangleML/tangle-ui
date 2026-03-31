import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useState } from "react";

import { StackingControls } from "@/components/shared/ReactFlow/FlowControls/StackingControls";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/typography";
import { AnnotationsBlock } from "@/routes/v2/pages/Editor/components/AnnotationsBlock/AnnotationsBlock";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { getTaskYamlText } from "./components/actions/getTaskYamlText";
import { ComponentRefBar } from "./components/ComponentRefBar";
import { ConfigurationSection } from "./components/ConfigurationSection";
import { OutputsSection } from "./components/OutputsSection";
import { TaskActionsBar } from "./components/TaskActionsBar";
import { TaskArgumentsEditor } from "./components/TaskArgumentsEditor";
import { TaskInfoSection } from "./components/TaskInfoSection";
import { useTaskConfigActions } from "./components/useTaskConfigActions";
import { useTask } from "./hooks/useTask";

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
  const showComponentRefBar = useFlagValue("task-component-ref-bar");
  const { editor } = useSharedStores();
  const { undo } = useEditorSession();
  const { renameTask } = useTaskActions();
  const { setTaskColor } = useTaskConfigActions();
  const spec = useSpec();
  const task = useTask(entityId);
  const { focusedArgumentName } = editor;

  const [openSections, setOpenSections] = useState<string[]>([
    "component",
    "task",
    "arguments",
    "actions",
  ]);

  useEffect(() => {
    if (focusedArgumentName && !openSections.includes("arguments")) {
      setOpenSections((prev) => [...prev, "arguments"]);
    }
  }, [focusedArgumentName]);

  if (!spec || !task) {
    return null;
  }

  const componentSpec = task.componentRef.spec;
  const inputCount = componentSpec?.inputs?.length ?? 0;
  const outputCount = componentSpec?.outputs?.length ?? 0;
  const annotationCount = task.annotations.filter(
    (a) => !EDITOR_ANNOTATION_KEYS.includes(a.key),
  ).length;
  const taskColor = task.annotations.get("tangleml.com/editor/task-color");

  const yamlText = getTaskYamlText(task);
  const pythonCode = componentSpec?.metadata?.annotations?.python_original_code;

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newName = event.target.value;
    if (newName && newName !== task.name) {
      renameTask(spec, entityId, newName);
    }
  };

  const handleColorChange = (color: string) => {
    setTaskColor(task, color);
  };

  const handleZIndexChange = (newZIndex: number) => {
    undo.withGroup("Update task z-index", () => {
      task.annotations.set("zIndex", newZIndex);
    });
  };

  return (
    <BlockStack gap="0" className="w-full overflow-auto">
      {!showComponentRefBar && (
        <BlockStack className="px-3 py-2">
          <TaskActionsBar entityId={entityId} />
        </BlockStack>
      )}
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="w-full overflow-auto"
      >
        {showComponentRefBar && (
          <AccordionItem value="component">
            <AccordionTrigger className="py-1.5 px-3 text-xs hover:no-underline">
              <Text
                size="xs"
                weight="semibold"
                className="uppercase tracking-wide text-gray-500"
              >
                Component
              </Text>
            </AccordionTrigger>
            <AccordionContent className="px-3 pb-2">
              <BlockStack>
                <ComponentRefBar
                  componentRef={task.componentRef}
                  yamlText={yamlText}
                  taskName={task.name}
                  pythonCode={pythonCode}
                />
              </BlockStack>
            </AccordionContent>
          </AccordionItem>
        )}
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
            <TaskInfoSection
              entityId={entityId}
              task={task}
              componentSpec={componentSpec}
              taskColor={taskColor}
              onNameChange={handleNameChange}
              onColorChange={handleColorChange}
            />
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
            <OutputsSection componentSpec={componentSpec} />
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

        <AccordionItem value="actions">
          <AccordionTrigger className="py-1.5 px-3 text-xs hover:no-underline">
            <Text
              size="xs"
              weight="semibold"
              className="uppercase tracking-wide text-gray-500"
            >
              Actions
            </Text>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-2">
            <InlineStack gap="2" blockAlign="center" className="w-full">
              <StackingControls
                nodeId={entityId}
                onChange={handleZIndexChange}
              />
              {showComponentRefBar && (
                <>
                  <Separator orientation="vertical" />
                  <TaskActionsBar entityId={entityId} />
                </>
              )}
            </InlineStack>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </BlockStack>
  );
});
