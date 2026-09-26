import { Link } from "@/components/ui/link";

import { InfoBox } from "../../InfoBox";

interface ManualSubmissionInstructionsProps {
  downloadUrl: string;
}

const VERTEX_PIPELINES_URL =
  "https://console.cloud.google.com/vertex-ai/pipelines";
const CREATE_RUN_DOCS_URL =
  "https://cloud.google.com/vertex-ai/docs/pipelines/run-pipeline#console";

export const ManualSubmissionInstructions = ({
  downloadUrl,
}: ManualSubmissionInstructionsProps) => {
  return (
    <InfoBox
      title="Manual Submission"
      className="text-xs text-muted-foreground"
    >
      Download{" "}
      <Link size="xs" href={downloadUrl} download="vertex_pipeline_job.json">
        pipeline_job.json
      </Link>
      , then go to{" "}
      <Link
        size="xs"
        href={VERTEX_PIPELINES_URL}
        target="_blank"
        rel="noreferrer"
      >
        Vertex Pipelines
      </Link>{" "}
      and{" "}
      <Link
        size="xs"
        href={CREATE_RUN_DOCS_URL}
        target="_blank"
        rel="noreferrer"
      >
        create a new run
      </Link>
      .
    </InfoBox>
  );
};
