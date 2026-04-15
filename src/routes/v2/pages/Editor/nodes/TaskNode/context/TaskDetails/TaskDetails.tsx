import { observer } from "mobx-react-lite";
import { type ChangeEvent, useEffect, useState } from "react";

import { StackingControls } from "@/components/shared/ReactFlow/FlowControls/StackingControls";
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
import type { ComponentSpecJson, Task } from "@/models/componentSpec";
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

function getTaskDetailsCounts(
  task: Task,
  componentSpec: ComponentSpecJson | undefined,
) {
  return {
    inputCount: componentSpec?.inputs?.length ?? 0,
    outputCount: componentSpec?.outputs?.length ?? 0,
    annotationCount: task.annotations.filter(
      (a) => !EDITOR_ANNOTATION_KEYS.includes(a.key),
    ).length,
  };
}

function SectionTriggerWithBadge({
  label,
  count,
}: {
  label: string;
  count: number;
}) {
  return (
    <AccordionTrigger className="py-1.5 px-3 text-xs hover:no-underline">
      <InlineStack gap="2" blockAlign="center">
        <Text
          size="xs"
          weight="semibold"
          className="uppercase tracking-wide text-gray-500"
        >
          {label}
        </Text>
        {count > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            {count}
          </Badge>
        )}
      </InlineStack>
    </AccordionTrigger>
  );
}

function SectionTrigger({ label }: { label: string }) {
  return (
    <AccordionTrigger className="py-1.5 px-3 text-xs hover:no-underline">
      <Text
        size="xs"
        weight="semibold"
        className="uppercase tracking-wide text-gray-500"
      >
        {label}
      </Text>
    </AccordionTrigger>
  );
}

interface TaskDetailsProps {
  entityId: string;
}

export const TaskDetails = observer(function TaskDetails({
  entityId,
}: TaskDetailsProps) {
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
  const { inputCount, outputCount, annotationCount } = getTaskDetailsCounts(
    task,
    componentSpec,
  );
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
      <Accordion
        type="multiple"
        value={openSections}
        onValueChange={setOpenSections}
        className="w-full overflow-auto"
      >
        <AccordionItem value="component">
          <SectionTrigger label="Component" />
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
        <AccordionItem value="task">
          <SectionTrigger label="Task" />
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
          <SectionTriggerWithBadge label="Arguments" count={inputCount} />
          <AccordionContent className="pb-2 px-3">
            <TaskArgumentsEditor task={task} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="outputs">
          <SectionTriggerWithBadge label="Outputs" count={outputCount} />
          <AccordionContent className="px-3 pb-2">
            <OutputsSection componentSpec={componentSpec} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="configuration">
          <SectionTrigger label="Configuration" />
          <AccordionContent className="px-3 pb-2">
            <ConfigurationSection task={task} />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="annotations">
          <SectionTriggerWithBadge
            label="Annotations"
            count={annotationCount}
          />
          <AccordionContent className="px-3 pb-2">
            <AnnotationsBlock
              annotations={task.annotations}
              ignoreAnnotationKeys={EDITOR_ANNOTATION_KEYS}
            />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="actions">
          <SectionTrigger label="Actions" />
          <AccordionContent className="px-3 pb-2">
            <InlineStack gap="2" blockAlign="center" className="w-full">
              <StackingControls
                nodeId={entityId}
                onChange={handleZIndexChange}
              />
              <Separator orientation="vertical" />
              <TaskActionsBar entityId={entityId} />
            </InlineStack>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </BlockStack>
  );
});
