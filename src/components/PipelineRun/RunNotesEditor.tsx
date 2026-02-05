import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { Paragraph } from "@/components/ui/typography";
import { useBackend } from "@/providers/BackendProvider";
import {
  fetchRunAnnotations,
  updateRunNotes,
} from "@/services/pipelineRunService";
import {
  getAnnotationValue,
  PIPELINE_RUN_NOTES_ANNOTATION,
} from "@/utils/annotations";
import { TWENTY_FOUR_HOURS_IN_MS } from "@/utils/constants";

interface RunNotesEditorProps {
  runId: string;
  readOnly?: boolean;
}

export const RunNotesEditor = ({ runId, readOnly }: RunNotesEditorProps) => {
  const { backendUrl } = useBackend();

  const {
    data: annotations,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["pipeline-run-annotations", runId],
    queryFn: () => fetchRunAnnotations(runId, backendUrl),
    enabled: !!runId,
    refetchOnWindowFocus: false,
    staleTime: TWENTY_FOUR_HOURS_IN_MS,
  });

  const { mutate: saveRunNotes, isPending } = useMutation({
    mutationFn: (runId: string) => updateRunNotes(runId, backendUrl, value),
    onSuccess: () => {
      refetch();
    },
  });

  const notes =
    getAnnotationValue(annotations, PIPELINE_RUN_NOTES_ANNOTATION) ?? "";

  const [value, setValue] = useState(notes);

  const onInputChange = (value: string) => {
    setValue(value);
  };

  const onBlur = () => {
    if (!runId || isLoading || value.trim() === notes.trim()) {
      return;
    }
    saveRunNotes(runId);
  };

  useEffect(() => {
    setValue(notes);
  }, [notes]);

  if (readOnly) {
    return (
      <Paragraph size="xs" tone="subdued">
        {notes || "No notes available."}
      </Paragraph>
    );
  }

  return (
    <Textarea
      key={notes}
      value={value}
      onChange={(e) => onInputChange(e.target.value)}
      onBlur={onBlur}
      placeholder="Share context about this pipeline run..."
      className="text-xs!"
      disabled={isPending}
    />
  );
};
