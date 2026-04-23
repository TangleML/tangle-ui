import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Heading, Text } from "@/components/ui/typography";
import { AnnotationsBlock } from "@/routes/v2/pages/Editor/components/AnnotationsBlock/AnnotationsBlock";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { getTaskYamlText } from "./components/actions/getTaskYamlText";
import { ComponentRefBar } from "./components/ComponentRefBar";
import { ConfigurationSection } from "./components/ConfigurationSection";
import { OutputsSection } from "./components/OutputsSection";
import { TaskArgumentsEditor } from "./components/TaskArgumentsEditor";
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
  const { editor } = useSharedStores();
  const spec = useSpec();
  const task = useTask(entityId);
  const { focusedArgumentName } = editor;

  const [argumentsOpen, setArgumentsOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);

  useEffect(() => {
    if (focusedArgumentName && !argumentsOpen) {
      setArgumentsOpen(true);
    }
  }, [focusedArgumentName, argumentsOpen]);

  if (!spec || !task) {
    return null;
  }

  const componentSpec = task.resolvedComponentSpec;
  const yamlText = getTaskYamlText(task);
  const pythonCode = componentSpec?.metadata?.annotations?.python_original_code;

  const isSubgraphTask = task.subgraphSpec !== undefined;

  return (
    <BlockStack gap="0" className="w-full h-full">
      {/* ── Header ── */}
      <BlockStack gap="2" className="px-4 pt-3 pb-2">
        <InlineStack
          gap="2"
          blockAlign="center"
          align="space-between"
          className="w-full"
        >
          <InlineStack
            gap="2"
            blockAlign="center"
            wrap="nowrap"
            className="min-w-0"
          >
            {isSubgraphTask && (
              <Icon name="Workflow" size="sm" className="shrink-0" />
            )}
            <Text size="md" weight="semibold" className="wrap-anywhere">
              {task.name}
            </Text>
          </InlineStack>
        </InlineStack>

        <ComponentRefBar
          componentRef={
            task.subgraphSpec
              ? { ...task.componentRef, spec: componentSpec }
              : task.componentRef
          }
          yamlText={yamlText}
          taskName={task.name}
          pythonCode={pythonCode}
        />
      </BlockStack>

      {/* ── Sections ── */}
      <BlockStack gap="0" className="flex-1 overflow-y-auto">
        {/* ── Arguments ── */}
        <Collapsible
          open={argumentsOpen}
          onOpenChange={setArgumentsOpen}
          className="w-full"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 cursor-pointer border-b border-gray-100">
            <InlineStack gap="2" blockAlign="center">
              <Icon name="Parentheses" size="xs" />
              <Text size="sm" weight="semibold">
                Arguments
              </Text>
            </InlineStack>
            <Icon
              name={argumentsOpen ? "ChevronDown" : "ChevronRight"}
              size="xs"
              className="text-muted-foreground"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 py-3">
            <BlockStack gap="4">
              <BlockStack gap="2">
                <Heading level={3}>Inputs</Heading>
                <TaskArgumentsEditor task={task} />
              </BlockStack>
              <Separator />
              <BlockStack gap="2">
                <Heading level={3}>Outputs</Heading>
                <OutputsSection componentSpec={componentSpec} />
              </BlockStack>
            </BlockStack>
          </CollapsibleContent>
        </Collapsible>

        {/* ── Configuration ── */}
        <Collapsible
          open={configOpen}
          onOpenChange={setConfigOpen}
          className="w-full"
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 cursor-pointer border-b border-gray-100">
            <InlineStack gap="2" blockAlign="center">
              <Icon name="Settings" size="xs" />
              <Text size="sm" weight="semibold">
                Config
              </Text>
            </InlineStack>
            <Icon
              name={configOpen ? "ChevronDown" : "ChevronRight"}
              size="xs"
              className="text-muted-foreground"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 py-3">
            <BlockStack gap="4">
              <ConfigurationSection task={task} />

              <Separator />

              <AnnotationsBlock
                annotations={task.annotations}
                defaultEditing
                ignoreAnnotationKeys={EDITOR_ANNOTATION_KEYS}
              />
            </BlockStack>
          </CollapsibleContent>
        </Collapsible>
      </BlockStack>
    </BlockStack>
  );
});
