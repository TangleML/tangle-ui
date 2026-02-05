import { useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import {
  getAnnotationValue,
  PIPELINE_NOTES_ANNOTATION,
  setComponentSpecAnnotation,
} from "@/utils/annotations";

export const PipelineNotesEditor = () => {
  const { componentSpec, setComponentSpec } = useComponentSpec();

  const annotations = componentSpec.metadata?.annotations;
  const notes =
    getAnnotationValue(annotations, PIPELINE_NOTES_ANNOTATION) ?? "";

  const [value, setValue] = useState(notes);

  const onInputChange = (value: string) => {
    setValue(value);
  };

  const onBlur = () => {
    setComponentSpec(
      setComponentSpecAnnotation(
        componentSpec,
        PIPELINE_NOTES_ANNOTATION,
        value,
      ),
    );
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
