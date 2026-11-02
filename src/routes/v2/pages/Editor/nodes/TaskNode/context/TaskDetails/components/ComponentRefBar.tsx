import { useComponentEditor } from "@/components/shared/ComponentEditor/ComponentEditorProvider";
import { ComponentReferenceBar } from "@/components/shared/TaskDetails/ComponentReferenceBar";
import type { ComponentReference as ModelComponentReference } from "@/models/componentSpec/entities/types";

interface ComponentRefBarProps {
  componentRef: ModelComponentReference;
  yamlText: string;
  taskName: string;
  pythonCode: string | undefined;
  readOnly?: boolean;
}

export function ComponentRefBar({
  componentRef,
  yamlText,
  taskName,
  pythonCode,
  readOnly = false,
}: ComponentRefBarProps) {
  const { openComponentEditor } = useComponentEditor();

  return (
    <ComponentReferenceBar
      componentRef={componentRef}
      yamlText={yamlText}
      filename={taskName}
      pythonCode={pythonCode}
      readOnly={readOnly}
      trackingPrefix="v2.pipeline_editor.task_details"
      onEditComponent={
        readOnly ? undefined : () => openComponentEditor({ text: yamlText })
      }
    />
  );
}
