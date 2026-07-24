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
import { BlockStack, InlineStack } from "@/components/ui/layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Heading, Paragraph } from "@/components/ui/typography";
import type { Task } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import type { AnnotationConfig, Annotations } from "@/types/annotations";
import {
  EDITOR_COLLAPSED_ANNOTATION,
  EDITOR_CONDITIONAL_EXECUTION_ANNOTATION,
  TASK_COLOR_ANNOTATION,
} from "@/utils/annotations";
import { IS_ENABLED_PORT_NAME } from "@/utils/conditionalExecution";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

import type { EnableTaskMode } from "./taskConfig.actions";
import { useTaskConfigActions } from "./useTaskConfigActions";

interface ConfigurationSectionProps {
  task: Task;
}

export const ConfigurationSection = observer(function ConfigurationSection({
  task,
}: ConfigurationSectionProps) {
  const { track } = useAnalytics();
  const spec = useSpec();
  const {
    toggleCacheDisable,
    saveAnnotation,
    setTaskColor,
    clearProviderAnnotations,
    setCollapsed,
    setEnableTaskMode,
  } = useTaskConfigActions();
  const isSubgraph = task.subgraphSpec !== undefined;

  const isConditionalConnected =
    spec?.bindings.some(
      (b) =>
        b.targetEntityId === task.$id &&
        b.targetPortName === IS_ENABLED_PORT_NAME,
    ) ?? false;
  const isConditional =
    task.annotations.get(EDITOR_CONDITIONAL_EXECUTION_ANNOTATION) === "true" ||
    isConditionalConnected;
  const enableMode: EnableTaskMode = isConditional
    ? "conditional"
    : task.isEnabled === "false"
      ? "false"
      : "true";

  const handleEnableModeChange = (value: string) => {
    if (!spec) return;
    const mode = value as EnableTaskMode;
    setEnableTaskMode(spec, task, mode);
    track("v2.pipeline_editor.task_details.enable_task.change", { mode });
  };

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

  const taskColor = task.annotations.get(TASK_COLOR_ANNOTATION);
  const isCollapsed =
    task.annotations.get(EDITOR_COLLAPSED_ANNOTATION) === "true";

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

      <Separator />

      <BlockStack gap="1">
        <InlineStack align="space-between" gap="2" className="w-full">
          <Paragraph size="xs" tone="subdued">
            Enable task
          </Paragraph>
          <Select value={enableMode} onValueChange={handleEnableModeChange}>
            <SelectTrigger className="h-6 text-xs px-2 py-0 min-w-25">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true" className="text-xs">
                True
              </SelectItem>
              <SelectItem value="false" className="text-xs">
                False
              </SelectItem>
              <SelectItem value="conditional" className="text-xs">
                Conditional
              </SelectItem>
            </SelectContent>
          </Select>
        </InlineStack>
        {isConditional && !isConditionalConnected && (
          <Paragraph size="xs" tone="subdued">
            Connect a task output or pipeline input to the “Is enabled?” port on
            the node.
          </Paragraph>
        )}
      </BlockStack>

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
