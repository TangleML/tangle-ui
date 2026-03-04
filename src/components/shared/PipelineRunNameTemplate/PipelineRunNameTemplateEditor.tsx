import { useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useComponentSpecStore } from "@/stores/componentSpecStore";
import { useRootMetadata } from "@/stores/selectors";
import {
  getAnnotationValue,
  RUN_NAME_TEMPLATE_ANNOTATION,
} from "@/utils/annotations";

interface PipelineRunNameTemplateEditorProps {
  autoFocus?: boolean;
}

export const PipelineRunNameTemplateEditor = ({
  autoFocus,
}: PipelineRunNameTemplateEditorProps) => {
  const rootMetadata = useRootMetadata();
  const setGraphAnnotation = useComponentSpecStore((s) => s.setGraphAnnotation);
  const [localValue, setLocalValue] = useState(
    getAnnotationValue(rootMetadata?.annotations, RUN_NAME_TEMPLATE_ANNOTATION),
  );

  const updateRunNameTemplate = (runNameTemplate: string | undefined) => {
    if (runNameTemplate === undefined) {
      return;
    }

    setGraphAnnotation(["root"], RUN_NAME_TEMPLATE_ANNOTATION, runNameTemplate);
  };

  return (
    <Textarea
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
      onBlur={() => updateRunNameTemplate(localValue)}
      placeholder="Add a pipeline run name template..."
      className="min-h-5 resize-y"
      data-testid="pipeline-description-editor"
      autoFocus={autoFocus}
    />
  );
};
