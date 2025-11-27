import { useCallback, useEffect, useMemo, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import launcherTaskAnnotationSchema from "@/config/launcherTaskAnnotationSchema.json";
import useToastNotification from "@/hooks/useToastNotification";
import type { AnnotationConfig, Annotations } from "@/types/annotations";
import type { TaskSpec } from "@/utils/componentSpec";

import { AnnotationsEditor } from "./AnnotationsEditor";
import { ComputeResourcesEditor } from "./ComputeResourcesEditor";
import type { NewAnnotationRowData } from "./NewAnnotationRow";
import {
  getCloudProviderConfig,
  getCommonAnnotations,
  getProviderSchema,
  parseSchemaToAnnotationConfig,
  validateLauncherAnnotationSchema,
} from "./parseSchemaToAnnotationConfig";

interface AnnotationsSectionProps {
  taskSpec: TaskSpec;
  onApply: (annotations: Annotations) => void;
}

export const AnnotationsSection = ({
  taskSpec,
  onApply,
}: AnnotationsSectionProps) => {
  const notify = useToastNotification();

  const rawAnnotations = (taskSpec.annotations || {}) as Annotations;

  const [annotations, setAnnotations] = useState<Annotations>({
    ...rawAnnotations,
  });

  const [cloudProviderConfig, setCloudProviderConfig] =
    useState<AnnotationConfig | null>(null);
  const [pinnedAnnotations, setPinnedAnnotations] = useState<
    AnnotationConfig[]
  >([]);
  const [computeResources, setComputeResources] = useState<AnnotationConfig[]>(
    [],
  );

  // Track new rows separately until they have a key
  const [newRows, setNewRows] = useState<Array<NewAnnotationRowData>>([]);

  const selectedProvider = cloudProviderConfig
    ? annotations[cloudProviderConfig.annotation]
    : undefined;

  const commonAnnotations = useMemo(() => {
    const managedAnnotationKeys = new Set([
      ...computeResources.map((r) => r.annotation),
      ...(cloudProviderConfig ? [cloudProviderConfig.annotation] : []),
    ]);

    return Object.entries(annotations).reduce<Annotations>(
      (acc, [key, value]) => {
        if (!managedAnnotationKeys.has(key)) {
          acc[key] = value;
        }
        return acc;
      },
      {},
    );
  }, [annotations, computeResources, cloudProviderConfig]);

  const handleAddNewRow = useCallback(() => {
    const newRow = { id: Date.now().toString(), key: "", value: "" };
    setNewRows((rows) => [...rows, newRow]);
  }, []);

  const handleRemoveNewRow = useCallback((newRow: NewAnnotationRowData) => {
    setNewRows((rows) => rows.filter((row) => row.id !== newRow.id));
  }, []);

  const handleNewRowBlur = useCallback(
    (newRow: NewAnnotationRowData) => {
      if (newRow.key.trim() && !(newRow.key in annotations)) {
        const newAnnotations = {
          ...annotations,
          [newRow.key]: newRow.value,
        };
        setAnnotations(newAnnotations);
        onApply(newAnnotations);

        setNewRows((rows) => rows.filter((row) => row.id !== newRow.id));
      } else {
        if (newRow.key.trim() && newRow.key in annotations) {
          notify("Annotation key already exists", "warning");
        }

        setNewRows((rows) =>
          rows.map((row) =>
            row.id === newRow.id ? { ...row, ...newRow } : row,
          ),
        );
      }
    },
    [annotations, onApply, notify],
  );

  const handleRemove = useCallback(
    (key: string) => {
      const { [key]: _, ...rest } = annotations;
      const newAnnotations = rest;
      setAnnotations(newAnnotations);
      onApply(newAnnotations);
    },
    [annotations, onApply],
  );

  const handleSave = useCallback(
    (key: string, value: string | undefined) => {
      if (value === undefined || value === "") {
        // If value is empty or undefined, remove the annotation
        handleRemove(key);
        return;
      }

      const newAnnotations = {
        ...annotations,
        [key]: value,
      };

      setAnnotations(newAnnotations);
      onApply(newAnnotations);
    },
    [annotations, onApply, handleRemove],
  );

  useEffect(() => {
    setAnnotations(rawAnnotations);
  }, [rawAnnotations]);

  useEffect(() => {
    try {
      const schema = validateLauncherAnnotationSchema(
        launcherTaskAnnotationSchema,
      );

      const providerConfig = getCloudProviderConfig(schema);
      setCloudProviderConfig(providerConfig);

      const common = getCommonAnnotations(schema);
      setPinnedAnnotations(common);
    } catch (error) {
      console.error("Failed to load launcher annotation schema:", error);
    }
  }, []);

  // Provider-specific compute resources
  useEffect(() => {
    if (selectedProvider) {
      try {
        const schema = validateLauncherAnnotationSchema(
          launcherTaskAnnotationSchema,
        );
        const providerSchema = getProviderSchema(schema, selectedProvider);

        if (providerSchema) {
          const parsedResources = parseSchemaToAnnotationConfig(providerSchema);
          const filteredResources = parsedResources.filter(
            (res) => !res.hidden,
          );
          setComputeResources(filteredResources);
        } else {
          setComputeResources([]);
        }
      } catch (error) {
        console.error("Failed to load provider schema:", error);
        setComputeResources([]);
      }
    } else {
      setComputeResources([]);
    }
  }, [selectedProvider]);

  return (
    <BlockStack gap="2" className="overflow-y-auto pr-4 overflow-visible">
      <ComputeResourcesEditor
        cloudProviderConfig={cloudProviderConfig}
        resources={computeResources}
        annotations={annotations}
        onSave={handleSave}
      />

      <Separator className="mt-4 mb-2" />

      <AnnotationsEditor
        annotations={commonAnnotations}
        pinnedAnnotations={pinnedAnnotations}
        onSave={handleSave}
        onRemove={handleRemove}
        newRows={newRows}
        onNewRowBlur={handleNewRowBlur}
        onRemoveNewRow={handleRemoveNewRow}
        onAddNewRow={handleAddNewRow}
      />
    </BlockStack>
  );
};
