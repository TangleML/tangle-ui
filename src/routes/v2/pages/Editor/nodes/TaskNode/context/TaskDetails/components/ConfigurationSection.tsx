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
import { Text } from "@/components/ui/typography";
import type { Task } from "@/models/componentSpec";
import type { ComponentSpecJson } from "@/models/componentSpec/entities/types";
import { isGraphImplementation } from "@/models/componentSpec/entities/types";
import type { AnnotationConfig, Annotations } from "@/types/annotations";
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
  } = useTaskConfigActions();
  const componentSpec = task.componentRef.spec as ComponentSpecJson | undefined;
  const isSubgraph = componentSpec?.implementation
    ? isGraphImplementation(componentSpec.implementation)
    : false;

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

  const taskColor = task.annotations.get("tangleml.com/editor/task-color");

  const handleColorChange = (color: string) => {
    setTaskColor(task, color);
  };

  return (
    <BlockStack gap="3">
      <InlineStack align="space-between" gap="2" className="w-full">
        <Text size="xs" className="text-gray-600">
          Task color
        </Text>
        <ColorPicker
          title="Task color"
          color={taskColor}
          setColor={handleColorChange}
        />
      </InlineStack>
      <Separator />

      {!isSubgraph && (
        <>
          <InlineStack align="space-between" gap="2" className="w-full">
            <Text size="xs" className="text-gray-600">
              Disable cache
            </Text>
            <Switch
              checked={cacheDisabled}
              onCheckedChange={handleDisableCacheChange}
            />
          </InlineStack>
          <Separator />
        </>
      )}

      <ComputeResourcesEditor
        cloudProviderConfig={cloudProviderConfig}
        resources={computeResources}
        annotations={annotationsRecord}
        onSave={handleSave}
      />
    </BlockStack>
  );
});
