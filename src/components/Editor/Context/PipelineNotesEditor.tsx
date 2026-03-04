import { useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useComponentSpecStore } from "@/stores/componentSpecStore";
import { useRootMetadata } from "@/stores/selectors";
import {
  getAnnotationValue,
  PIPELINE_NOTES_ANNOTATION,
} from "@/utils/annotations";

export const PipelineNotesEditor = () => {
  const rootMetadata = useRootMetadata();
  const setGraphAnnotation = useComponentSpecStore((s) => s.setGraphAnnotation);

  const notes =
    getAnnotationValue(rootMetadata?.annotations, PIPELINE_NOTES_ANNOTATION) ??
    "";

  const [value, setValue] = useState(notes);

  const onInputChange = (value: string) => {
    setValue(value);
  };

  const onBlur = () => {
    setGraphAnnotation(["root"], PIPELINE_NOTES_ANNOTATION, value);
  };

  return (
    <Textarea
      value={value}
      onChange={(e) => onInputChange(e.target.value)}
      onBlur={onBlur}
      placeholder="Share context about this pipeline..."
      className="text-xs"
    />
  );
};
