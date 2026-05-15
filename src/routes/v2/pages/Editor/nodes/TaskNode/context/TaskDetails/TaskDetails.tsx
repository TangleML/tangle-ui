import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import { StackingControls } from "@/components/shared/ReactFlow/FlowControls/StackingControls";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Text } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { AnnotationsBlock } from "@/routes/v2/pages/Editor/components/AnnotationsBlock/AnnotationsBlock";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { EDITOR_COLLAPSED_ANNOTATION } from "@/utils/annotations";
import { tracking } from "@/utils/tracking";

import { getTaskYamlText } from "./components/actions/getTaskYamlText";
import { ComponentRefBar } from "./components/ComponentRefBar";
import { ConfigurationSection } from "./components/ConfigurationSection";
import { TaskActionsBar } from "./components/TaskActionsBar";
import { TaskArgumentsEditor } from "./components/TaskArgumentsEditor";
import { useTask } from "./hooks/useTask";

const SYSTEM_TASK_ANNOTATIONS = [
  "editor.position",
  "tangleml.com/editor/task-color",
  "tangleml.com/editor/edge-conduits",
  EDITOR_COLLAPSED_ANNOTATION,
];

interface TaskDetailsProps {
  entityId: string;
}

type DetailsTab = "arguments" | "configuration" | "annotations";

export const TaskDetails = observer(function TaskDetails({
  entityId,
}: TaskDetailsProps) {
  const { track } = useAnalytics();
  const { editor } = useSharedStores();
  const { undo } = useEditorSession();
  const { renameTask } = useTaskActions();
  const notify = useToastNotification();
  const spec = useSpec();
  const task = useTask(entityId);
  const { focusedArgumentName } = editor;

  const [detailsTab, setDetailsTab] = useState<DetailsTab>("arguments");
  const [isRenaming, setIsRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusedArgumentName) {
      setDetailsTab("arguments");
    }
  }, [focusedArgumentName]);

  const handleDetailsTabChange = (value: string) => {
    if (
      value === "arguments" ||
      value === "configuration" ||
      value === "annotations"
    ) {
      setDetailsTab(value);
    }
  };

  if (!spec || !task) {
    return null;
  }

  const componentSpec = task.resolvedComponentSpec;
  const yamlText = getTaskYamlText(task);
  const pythonCode = componentSpec?.metadata?.annotations?.python_original_code;

  const isSubgraphTask = task.subgraphSpec !== undefined;

  const handleZIndexChange = (newZIndex: number) => {
    undo.withGroup("Update task z-index", () => {
      task.annotations.set("zIndex", newZIndex);
    });
  };

  const handleRenameSubmit = () => {
    const newName = renameInputRef.current?.value.trim();
    setIsRenaming(false);
    if (newName && newName !== task.name) {
      const success = renameTask(spec, entityId, newName);
      if (success) {
        track("v2.pipeline_editor.task_details.rename.completed");
      } else {
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
    <BlockStack className="h-full min-h-0 w-full">
      {/* ── Header ── */}
      <BlockStack gap="2" className="shrink-0 px-4 pt-3 pb-2">
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
                <Text
                  size="md"
                  weight="semibold"
                  className="wrap-anywhere select-text"
                >
                  {task.name}
                </Text>
                <Button
                  variant="ghost"
                  size="inline-xs"
                  className="shrink-0 p-0 text-muted-foreground hover:bg-transparent hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={startRename}
                  {...tracking("v2.pipeline_editor.task_details.rename_start")}
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

      <Separator />

      {/* ── Arguments / Configuration tabs ── */}
      <Tabs
        value={detailsTab}
        onValueChange={handleDetailsTabChange}
        className="flex min-h-0 w-full flex-1 flex-col gap-0 px-4 pt-2"
      >
        <TabsList className="w-full shrink-0">
          <TabsTrigger
            value="arguments"
            className="min-w-0 flex-1 gap-1.5"
            {...tracking("v2.pipeline_editor.task_details.tab_arguments")}
          >
            <Icon name="Parentheses" size="xs" className="shrink-0" />
            <span className="truncate">Arguments</span>
          </TabsTrigger>
          <TabsTrigger
            value="configuration"
            className="min-w-0 flex-1 gap-1.5"
            {...tracking("v2.pipeline_editor.task_details.tab_configuration")}
          >
            <Icon name="Settings" size="xs" className="shrink-0" />
            <span className="truncate">Config</span>
          </TabsTrigger>
          <TabsTrigger
            value="annotations"
            className="flex-none w-8 px-0"
            {...tracking("v2.pipeline_editor.task_details.tab_annotations")}
          >
            <Icon name="EllipsisVertical" size="xs" className="shrink-0" />
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="arguments"
          className="mt-0 min-h-0 min-w-0 flex-1 overflow-y-auto py-3"
        >
          <TaskArgumentsEditor task={task} />
        </TabsContent>

        <TabsContent
          value="configuration"
          className="mt-0 min-h-0 min-w-0 flex-1 overflow-y-auto py-3"
        >
          <ConfigurationSection task={task} />
        </TabsContent>

        <TabsContent
          value="annotations"
          className="mt-0 min-h-0 min-w-0 flex-1 overflow-y-auto py-3"
        >
          <AnnotationsBlock
            annotations={task.annotations}
            systemAnnotationKeys={SYSTEM_TASK_ANNOTATIONS}
          />
        </TabsContent>
      </Tabs>
      <Separator />
      <BlockStack className="px-4 pt-4">
        <Heading level={2}>Actions</Heading>
        <InlineStack gap="2" blockAlign="center" className="shrink-0 py-2">
          <StackingControls nodeId={entityId} onChange={handleZIndexChange} />

          <TaskActionsBar entityId={entityId} />
        </InlineStack>
      </BlockStack>
    </BlockStack>
  );
});
