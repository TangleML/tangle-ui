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
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Paragraph, Text } from "@/components/ui/typography";
import type { Task } from "@/models/componentSpec";
import type { AnnotationConfig, Annotations } from "@/types/annotations";
import { EDITOR_COLLAPSED_ANNOTATION } from "@/utils/annotations";
import { ISO8601_DURATION_ZERO_DAYS } from "@/utils/constants";

import { useTaskConfigActions } from "./useTaskConfigActions";

interface ConfigurationSectionProps {
  task: Task;
}

export const ConfigurationSection = observer(function ConfigurationSection({
  task,
}: ConfigurationSectionProps) {
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
  };

  const handleSave = (key: string, value: string | undefined) => {
    saveAnnotation(task, key, value);
  };

  const handleColorChange = (color: string) => {
    setTaskColor(task, color);
  };

  const handleCollapsedChange = (checked: boolean) => {
    setCollapsed(task, checked);
  };

  const taskColor = task.annotations.get("tangleml.com/editor/task-color");
  const isCollapsed =
    task.annotations.get(EDITOR_COLLAPSED_ANNOTATION) === "true";

  return (
    <BlockStack gap="3">
      <Text
        as="h3"
        size="xs"
        weight="semibold"
        tone="subdued"
        role="heading"
        aria-level={3}
      >
        Configuration
      </Text>

      <InlineStack align="space-between" gap="2" className="w-full">
        <Paragraph size="xs" tone="subdued">
          Task color
        </Paragraph>
        <ColorPicker
          title="Task color"
          color={taskColor ?? "transparent"}
          setColor={handleColorChange}
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
