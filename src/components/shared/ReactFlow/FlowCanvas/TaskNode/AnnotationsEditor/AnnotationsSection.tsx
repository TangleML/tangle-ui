import { useCallback, useEffect, useState } from "react";

import { BlockStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import useToastNotification from "@/hooks/useToastNotification";
import type { Annotations } from "@/types/annotations";
import type { TaskSpec } from "@/utils/componentSpec";

import { AnnotationsEditor } from "./AnnotationsEditor";
import { ComputeResourcesEditor } from "./ComputeResourcesEditor";
import type { NewAnnotationRowData } from "./NewAnnotationRow";

interface AnnotationsSectionProps {
  taskSpec: TaskSpec;
  onApply: (annotations: Annotations) => void;
}

export const AnnotationsSection = ({
  taskSpec,
  onApply,
}: AnnotationsSectionProps) => {
  const notify = useToastNotification();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rawAnnotations = (taskSpec.annotations || {}) as Annotations;

  const [annotations, setAnnotations] = useState<Annotations>({
    ...rawAnnotations,
  });

  // Track new rows separately until they have a key
  const [newRows, setNewRows] = useState<Array<NewAnnotationRowData>>([]);

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

  return (
    <BlockStack gap="2" className="overflow-y-auto pr-4 py-2 overflow-visible">
      <ComputeResourcesEditor annotations={annotations} onSave={handleSave} />

      <Separator className="mt-4 mb-2" />

      <AnnotationsEditor
        annotations={annotations}
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
