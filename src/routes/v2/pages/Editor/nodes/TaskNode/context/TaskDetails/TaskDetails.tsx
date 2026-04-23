import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ColorPicker } from "@/components/ui/color";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Heading, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { AnnotationsBlock } from "@/routes/v2/pages/Editor/components/AnnotationsBlock/AnnotationsBlock";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { deriveColorPalette } from "@/routes/v2/shared/nodes/TaskNode/color.utils";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { isSubgraph } from "@/utils/subgraphUtils";

import { getTaskYamlText } from "./components/actions/getTaskYamlText";
import { ComponentRefBar } from "./components/ComponentRefBar";
import { ConfigurationSection } from "./components/ConfigurationSection";
import { OutputsSection } from "./components/OutputsSection";
import { TaskArgumentsEditor } from "./components/TaskArgumentsEditor";
import { useTaskConfigActions } from "./components/useTaskConfigActions";
import { useTask } from "./hooks/useTask";

const DEFAULT_BORDER_COLOR = "#9ca3af";

interface TaskDetailsProps {
  entityId: string;
}

export const TaskDetails = observer(function TaskDetails({
  entityId,
}: TaskDetailsProps) {
  const { editor } = useSharedStores();
  const { setTaskColor } = useTaskConfigActions();
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

  const componentSpec = task.componentRef.spec;
  const yamlText = getTaskYamlText(task);
  const pythonCode = componentSpec?.metadata?.annotations?.python_original_code;

  const isSubgraphTask = isSubgraph(task.componentRef.spec);
  const taskColor = task.annotations.get("tangleml.com/editor/task-color");

  const handleColorChange = (color: string) => {
    setTaskColor(task, color);
  };

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
            <InlineStack
              gap="2"
              blockAlign="center"
              className="shrink-0 pt-0.5"
            >
              <ColorPicker
                title="Task color"
                color={taskColor}
                setColor={handleColorChange}
                renderTrigger={(currentColor) => {
                  const palette = deriveColorPalette(currentColor);
                  return (
                    <button
                      type="button"
                      className="flex items-center justify-center h-7 w-7 rounded-full border-2 cursor-pointer shrink-0"
                      style={{
                        backgroundColor: palette?.background ?? "white",
                        borderColor: palette?.border ?? DEFAULT_BORDER_COLOR,
                      }}
                    >
                      <Icon
                        name="Pipette"
                        size="xs"
                        style={{
                          color: palette?.text ?? DEFAULT_BORDER_COLOR,
                        }}
                      />
                    </button>
                  );
                }}
              />
              <div className="w-px h-7 bg-gray-300" />
              {isSubgraphTask && (
                <Icon name="Workflow" size="sm" className="shrink-0" />
              )}
            </InlineStack>
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
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={startRename}
                >
                  <Icon name="Pencil" size="xs" />
                </button>
              </div>
            )}
          </InlineStack>
        </InlineStack>

        <ComponentRefBar
          componentRef={task.componentRef}
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

              <AnnotationsBlock annotations={task.annotations} defaultEditing />
            </BlockStack>
          </CollapsibleContent>
        </Collapsible>
      </BlockStack>
    </BlockStack>
  );
});
