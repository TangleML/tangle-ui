import ConfirmationDialog from "@/components/shared/Dialogs/ConfirmationDialog";
import { RunIdentitySummary } from "@/components/shared/Submitters/Tangle/components/RunIdentitySummary";
import type { RerunReview } from "@/routes/v2/pages/RunView/hooks/useRerunPipelineRun";

interface RerunReviewDialogProps {
  review: RerunReview;
}

export function RerunReviewDialog({ review }: RerunReviewDialogProps) {
  return (
    <ConfirmationDialog
      isOpen={review.isOpen}
      title="Rerun this pipeline?"
      description="The rerun uses this run's arguments."
      content={
        <RunIdentitySummary
          team={review.team}
          missingSecrets={review.missingSecrets}
        />
      }
      onConfirm={review.confirm}
      onCancel={review.dismiss}
    />
  );
}
