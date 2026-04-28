import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Heading, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { AnnotationsBlock } from "@/routes/v2/pages/Editor/components/AnnotationsBlock/AnnotationsBlock";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { EDITOR_COLLAPSED_ANNOTATION } from "@/utils/annotations";

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
  EDITOR_COLLAPSED_ANNOTATION,
];

interface TaskDetailsProps {
  entityId: string;
}

export const TaskDetails = observer(function TaskDetails({
  entityId,
}: TaskDetailsProps) {
  const { editor } = useSharedStores();
  const { renameTask } = useTaskActions();
  const notify = useToastNotification();
  const spec = useSpec();
  const task = useTask(entityId);
  const { focusedArgumentName } = editor;

  const [argumentsOpen, setArgumentsOpen] = useState(true);
  const [configOpen, setConfigOpen] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

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

  const handleRenameSubmit = () => {
    const newName = renameInputRef.current?.value.trim();
    setIsRenaming(false);
    if (newName && newName !== task.name) {
      const success = renameTask(spec, entityId, newName);
      if (!success) {
        notify("A task with that name already exists", "error");
      }
    }
  };

  const startRename = () => {
    setIsRenaming(true);
    requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  };

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
            blockAlign="start"
            wrap="nowrap"
            className="min-w-0"
          >
            {isSubgraphTask && (
              <Icon name="Workflow" size="sm" className="shrink-0" />
            )}
            {isRenaming ? (
              <Input
                ref={renameInputRef}
                defaultValue={task.name}
                className="h-7 text-sm font-semibold flex-1 min-w-0"
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRenameSubmit();
                  if (e.key === "Escape") setIsRenaming(false);
                }}
              />
            ) : (
              <div className="group min-w-0 flex items-baseline gap-1">
                <Text size="md" weight="semibold" className="wrap-anywhere">
                  {task.name}
                </Text>
                <Button
                  variant="ghost"
                  size="inline-xs"
                  className="shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={startRename}
                >
                  <Icon name="Pencil" size="xs" />
                </Button>
              </div>
            )}
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
