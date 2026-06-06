import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";

import { ComputeResourcesEditor } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/AnnotationsEditor/ComputeResourcesEditor";
import {
  getCloudProviderConfig,
  getProviderSchema,
  launcherTaskAnnotationSchema,
  parseSchemaToAnnotationConfig,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/AnnotationsEditor/utils";
import { ColorPicker } from "@/components/ui/color";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Heading, Paragraph } from "@/components/ui/typography";
import type { Task } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useEditorSession } from "@/routes/v2/pages/Editor/store/EditorSessionContext";
import type { AnnotationConfig, Annotations } from "@/types/annotations";
import {
  EDITOR_COLLAPSED_ANNOTATION,
  LINEAGE_EXCLUDE_ANNOTATION,
  LINEAGE_ORIGIN_ANNOTATION,
  TASK_COLOR_ANNOTATION,
} from "@/utils/annotations";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

import { useTaskConfigActions } from "./useTaskConfigActions";

interface ConfigurationSectionProps {
  task: Task;
}

export const ConfigurationSection = observer(function ConfigurationSection({
  task,
}: ConfigurationSectionProps) {
  const { track } = useAnalytics();
  const { undo } = useEditorSession();
  const {
    toggleCacheDisable,
    saveAnnotation,
    setTaskColor,
    clearProviderAnnotations,
    setCollapsed,
  } = useTaskConfigActions();
  const isSubgraph = task.subgraphSpec !== undefined;

  const cacheDisabled =
    task.executionOptions?.cachingStrategy?.maxCacheStaleness ===
    ISO8601_DURATION_ZERO_DAYS;

  const annotationsRecord: Annotations = {};
  for (const item of task.annotations.items) {
    if (typeof item.value === "string") {
      annotationsRecord[item.key] = item.value;
    }
  }

  const [cloudProviderConfig, setCloudProviderConfig] =
    useState<AnnotationConfig | null>(null);
  const [computeResources, setComputeResources] = useState<AnnotationConfig[]>(
    [],
  );
  const [previousProvider, setPreviousProvider] = useState<string | undefined>(
    undefined,
  );

  const selectedProvider = cloudProviderConfig
    ? String(annotationsRecord[cloudProviderConfig.annotation])
    : undefined;

  useEffect(() => {
    try {
      const providerConfig = getCloudProviderConfig(
        launcherTaskAnnotationSchema,
      );
      setCloudProviderConfig(providerConfig);
    } catch (error) {
      console.error("Failed to load launcher annotation schema:", error);
    }
  }, []);

  useEffect(() => {
    if (selectedProvider === previousProvider) return;

    try {
      if (previousProvider) {
        const previousProviderSchema = getProviderSchema(
          launcherTaskAnnotationSchema,
          previousProvider,
        );
        if (previousProviderSchema) {
          const previousResources = parseSchemaToAnnotationConfig(
            previousProviderSchema,
          );
          clearProviderAnnotations(task, previousResources);
        }
      }

      let newResources: AnnotationConfig[] = [];
      if (selectedProvider) {
        const providerSchema = getProviderSchema(
          launcherTaskAnnotationSchema,
          selectedProvider,
        );
        if (providerSchema) {
          const parsedResources = parseSchemaToAnnotationConfig(providerSchema);
          newResources = parsedResources.filter((res) => !res.hidden);
        }
      }

      setComputeResources(newResources);
      setPreviousProvider(selectedProvider);
    } catch (error) {
      console.error("Failed to load provider schema:", error);
      setComputeResources([]);
    }
  }, [selectedProvider, previousProvider, task.annotations]);

  const handleDisableCacheChange = (checked: boolean) => {
    toggleCacheDisable(task, checked);
    track("v2.pipeline_editor.task_details.disable_cache.toggle", {
      cache_disabled: checked,
    });
  };

  const handleSave = (key: string, value: string | undefined) => {
    saveAnnotation(task, key, value);
  };

  const handleColorChange = (color: string) => {
    setTaskColor(task, color);
  };

  const handleCollapsedChange = (checked: boolean) => {
    setCollapsed(task, checked);
    track("v2.pipeline_editor.task_details.collapse_node.toggle");
  };

  const handleTrackingChange = (checked: boolean) => {
    undo.withGroup("Toggle lineage tracking", () => {
      if (!task.annotations.has(LINEAGE_ORIGIN_ANNOTATION)) {
        // First time enabling: stamp the origin so lineage exists going forward.
        task.annotations.set(LINEAGE_ORIGIN_ANNOTATION, {
          originId:
            task.componentRef.url ??
            task.componentRef.digest ??
            crypto.randomUUID(),
          originDigest: task.componentRef.digest,
          originName: task.componentRef.name,
        });
      }
      task.annotations.set(
        LINEAGE_EXCLUDE_ANNOTATION,
        checked ? "false" : "true",
      );
    });
    track("v2.pipeline_editor.task_details.lineage_tracking.toggle");
  };

  const taskColor = task.annotations.get(TASK_COLOR_ANNOTATION);
  const isCollapsed =
    task.annotations.get(EDITOR_COLLAPSED_ANNOTATION) === "true";
  // Tracking is ON when the exclude annotation is explicitly "false" (opted in)
  // OR when origin exists but the user has never been asked (exclude absent).
  const excludeValue = task.annotations.get(LINEAGE_EXCLUDE_ANNOTATION) as
    | string
    | undefined;
  const isTracking = excludeValue !== "true";

  return (
    <BlockStack gap="3">
      <Heading level={3}>General configuration</Heading>

      <InlineStack align="space-between" gap="2" className="w-full">
        <Paragraph size="xs" tone="subdued">
          Task color
        </Paragraph>
        <ColorPicker
          title="Task color"
          color={taskColor ?? "transparent"}
          setColor={handleColorChange}
          onClose={() =>
            track("v2.pipeline_editor.task_details.task_color_picker.closed")
          }
        />
      </InlineStack>

      {!isSubgraph && (
        <>
          <Separator />
          <InlineStack align="space-between" gap="2" className="w-full">
            <Paragraph size="xs" tone="subdued">
              Disable cache
            </Paragraph>
            <Switch
              checked={cacheDisabled}
              onCheckedChange={handleDisableCacheChange}
            />
          </InlineStack>
        </>
      )}

      <InlineStack align="space-between" gap="2" className="w-full">
        <Paragraph size="xs" tone="subdued">
          Collapse node
        </Paragraph>
        <Switch checked={isCollapsed} onCheckedChange={handleCollapsedChange} />
      </InlineStack>

      <InlineStack align="space-between" gap="2" className="w-full">
        <InlineStack gap="1" blockAlign="center">
          <Paragraph size="xs" tone="subdued">
            Reconcile changes
          </Paragraph>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center text-muted-foreground">
                <Icon name="Info" size="xs" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              When on, editing this component will offer to update any linked
              copies in this or other pipelines.
            </TooltipContent>
          </Tooltip>
        </InlineStack>
        <Switch checked={isTracking} onCheckedChange={handleTrackingChange} />
      </InlineStack>

      <Separator />

      <ComputeResourcesEditor
        cloudProviderConfig={cloudProviderConfig}
        resources={computeResources}
        annotations={annotationsRecord}
        onSave={handleSave}
      />
    </BlockStack>
  );
});
