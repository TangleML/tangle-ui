import { useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";

import { getRunNameTemplate, setRunNameTemplate } from "./utils";

interface PipelineRunNameTemplateEditorProps {
  autoFocus?: boolean;
}

export const PipelineRunNameTemplateEditor = ({
  autoFocus,
}: PipelineRunNameTemplateEditorProps) => {
  const { componentSpec, setComponentSpec } = useComponentSpec();
  const [localValue, setLocalValue] = useState(
    getRunNameTemplate(componentSpec),
  );

  const updateRunNameTemplate = (runNameTemplate: string | undefined) => {
    if (runNameTemplate === undefined) {
      return;
    }

    setComponentSpec(setRunNameTemplate(componentSpec, runNameTemplate));
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
