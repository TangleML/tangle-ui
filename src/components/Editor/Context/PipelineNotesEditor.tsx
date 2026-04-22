import { useEffect, useMemo, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import {
  getAnnotationValue,
  PIPELINE_NOTES_ANNOTATION,
  setComponentSpecAnnotation,
} from "@/utils/annotations";
import { debounce } from "@/utils/debounce";

const TRACK_DEBOUNCE_MS = 100;

export const PipelineNotesEditor = () => {
  const { componentSpec, setComponentSpec } = useComponentSpec();
  const { track } = useAnalytics();

  // eslint-disable-next-line no-restricted-syntax -- debounce() is stateful; compiler cannot prove purity
  const debouncedTrack = useMemo(
    () =>
      debounce(() => {
        track("pipeline_editor.configuration_panel.text_field_edited", {
          field: "notes",
        });
      }, TRACK_DEBOUNCE_MS),
    [track],
  );

  useEffect(() => () => debouncedTrack.cancel(), [debouncedTrack]);

  const annotations = componentSpec.metadata?.annotations;
  const notes =
    getAnnotationValue(annotations, PIPELINE_NOTES_ANNOTATION) ?? "";

  const [value, setValue] = useState(notes);

  const onBlur = () => {
    debouncedTrack();
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
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      placeholder="Share context about this pipeline..."
      className="text-xs"
    />
  );
};
