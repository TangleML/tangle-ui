import { Link, useParams } from "@tanstack/react-router";

import { BlockStack } from "@/components/ui/layout";
import { APP_ROUTES } from "@/routes/router";
import { MlExperimentPlannerContent } from "@/routes/v2/shared/components/MlExperimentPlanner/MlExperimentPlannerContent";

export function TangentProjectDetailView() {
  const { runId = "" } = useParams({ strict: false });

  return (
    <BlockStack gap="4" fill>
      <Link
        to={APP_ROUTES.TANGENT}
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0"
      >
        ← All projects
      </Link>
      <div className="flex-1 min-h-0">
        <MlExperimentPlannerContent runId={runId} />
      </div>
    </BlockStack>
  );
}
