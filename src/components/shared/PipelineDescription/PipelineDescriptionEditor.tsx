import { useEffect, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";

interface PipelineDescriptionEditorProps {
  autoFocus?: boolean;
}

export const PipelineDescriptionEditor = ({
  autoFocus,
}: PipelineDescriptionEditorProps) => {
  const { componentSpec, setComponentSpec } = useComponentSpec();
  const [localValue, setLocalValue] = useState(componentSpec.description ?? "");

  const setDescription = (description: string) => {
    setComponentSpec({
      ...componentSpec,
      description: description || undefined,
    });
  };

  // Sync local value when componentSpec.description changes externally
  useEffect(() => {
    setLocalValue(componentSpec.description ?? "");
  }, [componentSpec.description]);

  return (
    <Textarea
      value={localValue}
      onChange={(event) => setLocalValue(event.target.value)}
      onBlur={() => setDescription(localValue)}
      placeholder="Add a pipeline description..."
      className="min-h-5 resize-y"
      data-testid="pipeline-description-editor"
      autoFocus={autoFocus}
    />
  );
};
