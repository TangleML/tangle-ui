import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { TextBlock } from "@/components/shared/ContextPanel/Blocks/TextBlock";
import { StackingControls } from "@/components/shared/ReactFlow/FlowControls/StackingControls";
import { ColorPicker } from "@/components/ui/color";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Text } from "@/components/ui/typography";
import { AnnotationsBlock } from "@/routes/v2/pages/Editor/components/AnnotationsBlock/AnnotationsBlock";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

import { getTaskYamlText } from "./components/actions/getTaskYamlText";
import { ComponentRefBar } from "./components/ComponentRefBar";
import { ConfigurationSection } from "./components/ConfigurationSection";
import { OutputsSection } from "./components/OutputsSection";
import { TaskActionsBar } from "./components/TaskActionsBar";
import { TaskArgumentsEditor } from "./components/TaskArgumentsEditor";
import { useTaskConfigActions } from "./components/useTaskConfigActions";
import { useTask } from "./hooks/useTask";

const EDITOR_ANNOTATION_KEYS = [
  "editor.position",
  "tangleml.com/editor/task-color",
  "tangleml.com/editor/edge-conduits",
];

const TAB_CONTENT_CLASS = "overflow-y-auto w-full px-4 py-4 pr-5";

interface TaskDetailsProps {
  entityId: string;
}

export const TaskDetails = observer(function TaskDetails({
  entityId,
}: TaskDetailsProps) {
  const { editor } = useSharedStores();
  const { undo } = useEditorSession();
  const { setTaskColor } = useTaskConfigActions();
  const spec = useSpec();
  const task = useTask(entityId);
  const { focusedArgumentName } = editor;

  const [activeTab, setActiveTab] = useState("arguments");

  useEffect(() => {
    if (focusedArgumentName && activeTab !== "arguments") {
      setActiveTab("arguments");
    }
  }, [focusedArgumentName, activeTab]);

  if (!spec || !task) {
    return null;
  }

  const componentSpec = task.resolvedComponentSpec;
  const yamlText = getTaskYamlText(task);
  const pythonCode = componentSpec?.metadata?.annotations?.python_original_code;
  const author = componentSpec?.metadata?.annotations?.author;

  const isSubgraphTask = task.subgraphSpec !== undefined;
  const taskColor = task.annotations.get("tangleml.com/editor/task-color");

  const handleColorChange = (color: string) => {
    setTaskColor(task, color);
  };

  const handleZIndexChange = (newZIndex: number) => {
    undo.withGroup("Update task z-index", () => {
      task.annotations.set("zIndex", newZIndex);
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
            blockAlign="center"
            wrap="nowrap"
            className="min-w-0"
          >
            {isSubgraphTask && <Icon name="Workflow" size="sm" />}
            <Text size="sm" weight="semibold" className="wrap-anywhere">
              {task.name}
            </Text>
          </InlineStack>
          <InlineStack gap="1" blockAlign="center" className="shrink-0">
            <TaskActionsBar entityId={entityId} />
            <StackingControls nodeId={entityId} onChange={handleZIndexChange} />
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

      {/* ── Tabs ── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col gap-0 min-h-0 w-full"
      >
        <TabsList className="shrink-0 mx-4 mb-1">
          <TabsTrigger value="arguments" className="gap-1 text-xs px-2.5">
            <Icon name="Parentheses" size="xs" />
            Arguments
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-1 text-xs px-2.5">
            <Icon name="Info" size="xs" />
            Details
          </TabsTrigger>
          <TabsTrigger value="configuration" className="gap-1 text-xs px-2.5">
            <Icon name="Settings" size="xs" />
            Config
          </TabsTrigger>
        </TabsList>

        {/* ── Arguments ── */}
        <TabsContent value="arguments" className={TAB_CONTENT_CLASS}>
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
        </TabsContent>

        {/* ── Details ── */}
        <TabsContent value="details" className={TAB_CONTENT_CLASS}>
          <BlockStack gap="4">
            <TextBlock title="Task ID" text={entityId} />

            {author && <TextBlock title="Author" text={String(author)} />}

            <TextBlock
              title="Description"
              text={componentSpec?.description}
              collapsible
              defaultCollapsed
              wrap
            />

            {task.componentRef.digest && (
              <TextBlock
                title="Digest"
                text={task.componentRef.digest}
                copyable
              />
            )}

            {task.annotations.filter(
              (a) => !EDITOR_ANNOTATION_KEYS.includes(a.key),
            ).length > 0 && (
              <>
                <Separator />
                <AnnotationsBlock
                  annotations={task.annotations}
                  ignoreAnnotationKeys={EDITOR_ANNOTATION_KEYS}
                />
              </>
            )}
          </BlockStack>
        </TabsContent>

        {/* ── Configuration ── */}
        <TabsContent value="configuration" className={TAB_CONTENT_CLASS}>
          <BlockStack gap="4">
            <InlineStack
              align="space-between"
              blockAlign="center"
              className="w-full"
            >
              <Text size="sm" className="text-gray-600">
                Task color
              </Text>
              <ColorPicker
                title="Task color"
                color={taskColor}
                setColor={handleColorChange}
              />
            </InlineStack>

            <Separator />

            <ConfigurationSection task={task} />

            <Separator />

            <AnnotationsBlock
              annotations={task.annotations}
              defaultEditing
              ignoreAnnotationKeys={EDITOR_ANNOTATION_KEYS}
            />
          </BlockStack>
        </TabsContent>
      </Tabs>
    </BlockStack>
  );
});
