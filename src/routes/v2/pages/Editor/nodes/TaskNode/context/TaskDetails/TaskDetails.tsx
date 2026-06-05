import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";

import type { SaveAction } from "@/components/shared/ComponentEditor/saveAction";
import { SaveActionsView } from "@/components/shared/ComponentEditor/SaveActionsView";
import { computePlacementPosition } from "@/components/shared/ReactFlow/FlowCanvas/utils/computePlacementPosition";
import type { Bounds } from "@/components/shared/ReactFlow/FlowCanvas/utils/geometry";
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
import { PredictedIssuesSection } from "@/routes/v2/pages/Editor/components/UpgradeComponents/components/UpgradeCandidateDetail";
import { buildUpgradeCandidateFromResolved } from "@/routes/v2/pages/Editor/components/UpgradeComponents/utils/buildUpgradeCandidateFromResolved";
import { useTaskActions } from "@/routes/v2/pages/Editor/store/actions/useTaskActions";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import {
  EDITOR_POSITION_ANNOTATION,
  LINEAGE_ORIGIN_ANNOTATION,
  SYSTEM_ANNOTATIONS,
  ZINDEX_ANNOTATION,
} from "@/utils/annotations";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import { componentMetadata } from "@/utils/componentTracking";
import { DEFAULT_NODE_DIMENSIONS } from "@/utils/constants";
import { tracking } from "@/utils/tracking";

import { getTaskYamlText } from "./components/actions/getTaskYamlText";
import { ComponentRefBar } from "./components/ComponentRefBar";
import { ConfigurationSection } from "./components/ConfigurationSection";
import { TaskActionsBar } from "./components/TaskActionsBar";
import { TaskArgumentsEditor } from "./components/TaskArgumentsEditor";
import { useTask } from "./hooks/useTask";

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
  const { renameTask, replaceTask, addTask } = useTaskActions();
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

  const renderSaveActions = ({
    hydratedComponent,
    onChoose,
  }: {
    hydratedComponent: HydratedComponentReference;
    onChoose: (action: "update" | "import" | "place") => void;
  }) => {
    // Model the edit as an upgrade candidate so we reuse the upgrade flow's
    // diff + predicted-issues computation in the choose-action view.
    const candidate = buildUpgradeCandidateFromResolved(
      task.$id,
      task.name,
      task.componentRef.digest ?? "",
      task.resolvedComponentSpec,
      hydratedComponent,
      spec,
    );

    return (
      <SaveActionsView
        taskName={task.name}
        currentDigest={task.componentRef.digest}
        newDigest={hydratedComponent.digest}
        inputDiff={candidate.inputDiff}
        outputDiff={candidate.outputDiff}
        allowPlace
        onChoose={onChoose}
      >
        <PredictedIssuesSection issues={candidate.predictedIssues} />
      </SaveActionsView>
    );
  };

  const updateInPlace = (hydratedComponent: HydratedComponentReference) => {
    const result = replaceTask(spec, task.$id, hydratedComponent);
    const lostInputs = result.inputDiff?.lostEntities ?? [];

    track("pipeline_editor.component.edited", {
      ...componentMetadata(hydratedComponent, "user"),
      action: "update",
      lost_inputs_count: lostInputs.length,
    });

    if (lostInputs.length > 0) {
      const inputNames = lostInputs.map((input) => input.name).join(", ");
      notify(
        `Component updated. Removed ${lostInputs.length} input(s) no longer defined: ${inputNames}.`,
        "warning",
      );
    } else {
      notify("Component updated", "success");
    }
  };

  const placeAsNewTask = (hydratedComponent: HydratedComponentReference) => {
    // Positions live in task annotations; sizes aren't tracked there, so use
    // the default node dimensions for overlap (the reveal animation handles
    // any imprecision).
    const ESTIMATED_NODE_HEIGHT = 120;
    const toRect = (pos: { x: number; y: number }): Bounds => ({
      x: pos.x,
      y: pos.y,
      width: DEFAULT_NODE_DIMENSIONS.w,
      height: ESTIMATED_NODE_HEIGHT,
    });
    const positionOf = (taskId: string) =>
      [...spec.tasks]
        .find((t) => t.$id === taskId)
        ?.annotations.get(EDITOR_POSITION_ANNOTATION) as
        | { x: number; y: number }
        | undefined;

    const anchorRect = toRect(positionOf(task.$id) ?? { x: 0, y: 0 });
    const otherRects = [...spec.tasks]
      .filter((t) => t.$id !== task.$id)
      .map((t) => t.annotations.get(EDITOR_POSITION_ANNOTATION))
      .filter((pos): pos is { x: number; y: number } => pos != null)
      .map(toRect);

    const position = computePlacementPosition(anchorRect, otherRects, {
      prefer: "below",
    });

    // The placed task descends from the same origin as the edited task, so it
    // inherits that task's lineage rather than deriving a fresh one from the
    // edited component's (now-changed) digest.
    const inheritedLineage = task.annotations.get(LINEAGE_ORIGIN_ANNOTATION);
    const newTask = addTask(
      spec,
      hydratedComponent,
      position,
      inheritedLineage,
    );

    track("pipeline_editor.component.edited", {
      ...componentMetadata(hydratedComponent, "user"),
      action: "place",
    });

    notify("Task added", "success");

    // Reveal the new node: animate the viewport to it, then spotlight it.
    editor.setPendingFocusNode(newTask.$id);
    editor.setSpotlightNode(newTask.$id);
  };

  const handleComponentSaved = (
    hydratedComponent: HydratedComponentReference,
    action: SaveAction,
  ) => {
    if (action === "update") {
      updateInPlace(hydratedComponent);
    } else if (action === "place") {
      placeAsNewTask(hydratedComponent);
    }
  };

  const handleZIndexChange = (newZIndex: number) => {
    undo.withGroup("Update task z-index", () => {
      task.annotations.set(ZINDEX_ANNOTATION, newZIndex);
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
          onComponentSaved={handleComponentSaved}
          renderSaveActions={renderSaveActions}
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
            systemAnnotationKeys={SYSTEM_ANNOTATIONS}
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
