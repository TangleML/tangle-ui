import { observer } from "mobx-react-lite";
import { useEffect, useId, useState } from "react";

import { ComputeResourcesEditor } from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/AnnotationsEditor/ComputeResourcesEditor";
import {
  getCloudProviderConfig,
  getProviderSchema,
  launcherTaskAnnotationSchema,
  parseSchemaToAnnotationConfig,
} from "@/components/shared/ReactFlow/FlowCanvas/TaskNode/AnnotationsEditor/utils";
import { useFlagValue } from "@/components/shared/Settings/useFlags";
import { ColorPicker } from "@/components/ui/color";
import { Label } from "@/components/ui/label";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { Task } from "@/models/componentSpec";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import {
  CONDITION_LABEL_CLASSES,
  CONDITION_SURFACE_CLASSES,
} from "@/routes/v2/shared/conditionalExecution.styles";
import { useSpec } from "@/routes/v2/shared/providers/SpecContext";
import type { AnnotationConfig, Annotations } from "@/types/annotations";
import {
  EDITOR_COLLAPSED_ANNOTATION,
  TASK_COLOR_ANNOTATION,
} from "@/utils/annotations";
import {
  CONDITION_LITERAL_LABELS,
  describeConditionSource,
  isConditionalExecutionSupported,
  isTaskConditional,
  resolveConditionalReference,
  RUN_CONDITION_LABEL,
  toConditionLiteral,
} from "@/utils/conditionalExecution";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

import { useTaskConfigActions } from "./useTaskConfigActions";

interface ConfigurationSectionProps {
  task: Task;
}

export const ConfigurationSection = observer(function ConfigurationSection({
  task,
}: ConfigurationSectionProps) {
  const { track } = useAnalytics();
  const spec = useSpec();
  const conditionalExecutionEnabled = useFlagValue("conditional-execution");
  const {
    toggleCacheDisable,
    saveAnnotation,
    setTaskColor,
    clearProviderAnnotations,
    setCollapsed,
    setConditionalExecution,
    setRunCondition,
  } = useTaskConfigActions();
  const isSubgraph = task.isSubgraph;
  const conditionalSwitchId = useId();
  const runConditionLabelId = useId();

  const isConditional = isTaskConditional(task, spec);
  const conditionSource = describeConditionSource(
    resolveConditionalReference(task, spec) ?? task.isEnabled,
  );

  const handleConditionalChange = (checked: boolean) => {
    if (!spec) return;
    setConditionalExecution(spec, task, checked);
    track("v2.pipeline_editor.task_details.conditional_execution.toggle", {
      conditional: checked,
    });
  };

  const handleRunConditionChange = (value: string) => {
    const literal = toConditionLiteral(value);
    setRunCondition(task, literal);
    track("v2.pipeline_editor.task_details.run_condition.change", { literal });
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

      {conditionalExecutionEnabled && isConditionalExecutionSupported(task) && (
        <>
          <Separator />

          <BlockStack
            gap="3"
            className={cn("rounded-lg p-3", CONDITION_SURFACE_CLASSES)}
          >
            <InlineStack align="space-between" gap="2" className="w-full">
              <Label
                htmlFor={conditionalSwitchId}
                className={cn("text-xs font-medium", CONDITION_LABEL_CLASSES)}
              >
                Conditional execution
              </Label>
              <Switch
                id={conditionalSwitchId}
                checked={isConditional}
                onCheckedChange={handleConditionalChange}
              />
            </InlineStack>

            {isConditional && (
              <InlineStack
                align="space-between"
                blockAlign="center"
                gap="2"
                className="w-full"
              >
                <Paragraph size="xs" tone="subdued" id={runConditionLabelId}>
                  {RUN_CONDITION_LABEL}
                </Paragraph>
                {conditionSource ? (
                  <Text size="xs" className="min-w-0 truncate">
                    {conditionSource}
                  </Text>
                ) : (
                  <Tabs
                    value={toConditionLiteral(task.isEnabled)}
                    onValueChange={handleRunConditionChange}
                  >
                    <TabsList
                      className="h-6"
                      aria-labelledby={runConditionLabelId}
                    >
                      <TabsTrigger value="true" className="text-xs px-2.5">
                        {CONDITION_LITERAL_LABELS.true}
                      </TabsTrigger>
                      <TabsTrigger value="false" className="text-xs px-2.5">
                        {CONDITION_LITERAL_LABELS.false}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              </InlineStack>
            )}
          </BlockStack>
        </>
      )}

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
