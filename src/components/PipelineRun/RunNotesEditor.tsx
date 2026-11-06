import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Textarea } from "@/components/ui/textarea";
import { Paragraph } from "@/components/ui/typography";
import useToastNotification from "@/hooks/useToastNotification";
import { useBackend } from "@/providers/BackendProvider";
import { updateRunAnnotation } from "@/services/pipelineRunService";
import { runAnnotationsQueryOptions } from "@/services/runAnnotations";
import {
  getAnnotationValue,
  PIPELINE_RUN_NOTES_ANNOTATION,
} from "@/utils/annotations";

interface RunNotesEditorProps {
  runId: string;
  readOnly?: boolean;
  teamId?: string;
}

export const RunNotesEditor = ({
  runId,
  readOnly,
  teamId,
}: RunNotesEditorProps) => {
  const { backendUrl } = useBackend();
  const notify = useToastNotification();

  const {
    data: annotations,
    isLoading,
    refetch,
  } = useQuery({
    ...runAnnotationsQueryOptions(runId, backendUrl),
  });

  const { mutate: saveRunNotes, isPending } = useMutation({
    mutationFn: (runId: string) =>
      updateRunAnnotation(
        runId,
        backendUrl,
        {
          key: PIPELINE_RUN_NOTES_ANNOTATION,
          value: value,
        },
        teamId,
      ),
    onSuccess: () => {
      refetch();
    },
    onError: (error) => {
      notify(error.message, "error");
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
