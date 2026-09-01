import { useCallback, useEffect, useMemo, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import { useLauncherAnnotationSchema } from "@/hooks/useLauncherCapabilities";
import useToastNotification from "@/hooks/useToastNotification";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import type { Annotations } from "@/types/annotations";
import { getAnnotationValue, HIDDEN_ANNOTATIONS } from "@/utils/annotations";
import type { TaskSpec } from "@/utils/componentSpec";

import { AnnotationsEditor } from "./AnnotationsEditor";
import { ComputeResourcesEditor } from "./ComputeResourcesEditor";
import type { NewAnnotationRowData } from "./NewAnnotationRow";
import {
  ACCELERATORS_ANNOTATION,
  clusterAnnotationDiff,
  getCloudProviderConfig,
  getCommonAnnotations,
  getProviderSchema,
  type LauncherAnnotationSchema,
  parseSchemaToAnnotationConfig,
  resolveClusterSelection,
  resolveSelectedClusterKey,
} from "./utils";

interface AnnotationsSectionProps {
  taskSpec: TaskSpec;
  onApply: (annotations: Annotations) => void;
}

export const AnnotationsSection = ({
  taskSpec,
  onApply,
}: AnnotationsSectionProps) => {
  const notify = useToastNotification();
  const { track } = useAnalytics();

  const rawAnnotations = taskSpec.annotations ?? {};

  const [annotations, setAnnotations] = useState<Annotations>({
    ...rawAnnotations,
  });

  const { schema, capabilitiesActive } = useLauncherAnnotationSchema();
  const cloudProviderConfig = useMemo(
    () => getCloudProviderConfig(schema),
    [schema],
  );
  const pinnedAnnotations = useMemo(
    () => getCommonAnnotations(schema),
    [schema],
  );
  const [previousProvider, setPreviousProvider] = useState<string | undefined>(
    undefined,
  );

  // Track new rows separately until they have a key
  const [newRows, setNewRows] = useState<Array<NewAnnotationRowData>>([]);

  const selectedProvider = !cloudProviderConfig
    ? undefined
    : capabilitiesActive
      ? resolveSelectedClusterKey(schema, annotations)
      : getAnnotationValue(annotations, cloudProviderConfig.annotation);

  const computeResources = useMemo(() => {
    if (!selectedProvider) {
      return [];
    }
    const providerSchema = getProviderSchema(schema, selectedProvider);
    if (!providerSchema) {
      return [];
    }
    return parseSchemaToAnnotationConfig(providerSchema).filter(
      (resource) => !resource.hidden,
    );
  }, [schema, selectedProvider]);

  const commonAnnotations = useMemo(() => {
    const managedAnnotationKeys = new Set([
      ...computeResources.map((r) => r.annotation),
      ...(cloudProviderConfig ? [cloudProviderConfig.annotation] : []),
    ]);

    return Object.entries(annotations).reduce<Annotations>(
      (acc, [key, value]) => {
        if (!managedAnnotationKeys.has(key) && !HIDDEN_ANNOTATIONS.has(key)) {
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
        track("pipeline_editor.task_node.annotation_added");
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

      if (
        capabilitiesActive &&
        cloudProviderConfig &&
        key === cloudProviderConfig.annotation
      ) {
        const selection = resolveClusterSelection(
          schema,
          value,
          getAnnotationValue(annotations, ACCELERATORS_ANNOTATION),
        );
        if (selection) {
          const newAnnotations = {
            ...annotations,
            [cloudProviderConfig.annotation]: selection.cloudProviderValue,
          };
          if (selection.acceleratorAnnotation && selection.acceleratorValue) {
            newAnnotations[selection.acceleratorAnnotation] =
              selection.acceleratorValue;
          }
          setAnnotations(newAnnotations);
          onApply(newAnnotations);
          return;
        }
      }

      const newAnnotations = {
        ...annotations,
        [key]: value,
      };

      setAnnotations(newAnnotations);
      onApply(newAnnotations);
    },
    [
      annotations,
      onApply,
      handleRemove,
      capabilitiesActive,
      cloudProviderConfig,
      schema,
    ],
  );

  useEffect(() => {
    setAnnotations(rawAnnotations);
  }, [rawAnnotations]);

  // Drop the previous provider's annotations when switching providers.
  useEffect(() => {
    if (selectedProvider === previousProvider) {
      return;
    }

    if (previousProvider) {
      const annotationsToRemove = capabilitiesActive
        ? clusterAnnotationDiff(schema, previousProvider, selectedProvider)
        : previousProviderAnnotationKeys(schema, previousProvider);

      if (annotationsToRemove.length > 0) {
        const cleanedAnnotations = { ...annotations };
        annotationsToRemove.forEach((key) => {
          delete cleanedAnnotations[key];
        });
        setAnnotations(cleanedAnnotations);
        onApply(cleanedAnnotations);
      }
    }

    setPreviousProvider(selectedProvider);
  }, [
    selectedProvider,
    previousProvider,
    capabilitiesActive,
    schema,
    annotations,
    onApply,
  ]);

  return (
    <BlockStack gap="2" className="overflow-y-auto pr-4 overflow-visible">
      <ComputeResourcesEditor
        cloudProviderConfig={cloudProviderConfig}
        resources={computeResources}
        annotations={annotations}
        onSave={handleSave}
        providerValue={capabilitiesActive ? selectedProvider : undefined}
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

function previousProviderAnnotationKeys(
  schema: LauncherAnnotationSchema,
  provider: string,
): string[] {
  const previousProviderSchema = getProviderSchema(schema, provider);
  return previousProviderSchema
    ? parseSchemaToAnnotationConfig(previousProviderSchema).map(
        (resource) => resource.annotation,
      )
    : [];
}
