import { useEffect, useMemo, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { debounce } from "@/utils/debounce";

const TRACK_DEBOUNCE_MS = 100;

interface PipelineDescriptionEditorProps {
  autoFocus?: boolean;
}

export const PipelineDescriptionEditor = ({
  autoFocus,
}: PipelineDescriptionEditorProps) => {
  const { componentSpec, setComponentSpec } = useComponentSpec();
  const { track } = useAnalytics();

  // eslint-disable-next-line no-restricted-syntax -- debounce() is stateful; compiler cannot prove purity
  const debouncedTrack = useMemo(
    () =>
      debounce(() => {
        track("pipeline_editor.configuration_panel.text_field_edited", {
          field: "description",
        });
      }, TRACK_DEBOUNCE_MS),
    [track],
  );

  useEffect(() => () => debouncedTrack.cancel(), [debouncedTrack]);

  const [localValue, setLocalValue] = useState(componentSpec.description ?? "");

  const setDescription = (description: string) => {
    debouncedTrack();
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
