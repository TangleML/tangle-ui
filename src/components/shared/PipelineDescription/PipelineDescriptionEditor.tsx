import { useEffect, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useComponentSpecStore } from "@/stores/componentSpecStore";
import { useRootDescription } from "@/stores/selectors";

interface PipelineDescriptionEditorProps {
  autoFocus?: boolean;
}

export const PipelineDescriptionEditor = ({
  autoFocus,
}: PipelineDescriptionEditorProps) => {
  const rootDescription = useRootDescription();
  const setGraphDescription = useComponentSpecStore(
    (s) => s.setGraphDescription,
  );
  const [localValue, setLocalValue] = useState(rootDescription ?? "");

  const setDescription = (description: string) => {
    setGraphDescription(["root"], description || undefined);
  };

  // Sync local value when description changes externally
  useEffect(() => {
    setLocalValue(rootDescription ?? "");
  }, [rootDescription]);

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
