import { DocumentEditor } from "@/components/Project/DocumentEditor";
import { parseIdentity } from "@/services/projects/resourceTarget";
import { useProjectResource } from "@/services/projects/useProjectResources";

import { registerWorkareaKind } from "./registry";
import type { WorkareaTab } from "./types";
import { WorkareaLoading, WorkareaMessage } from "./WorkareaPlaceholder";

function DocumentWorkareaView({
  tab,
  projectId,
}: {
  tab: WorkareaTab;
  projectId: string;
}) {
  const resourceId = parseIdentity(tab.target.identity).value;
  const {
    data: resource,
    isPending,
    isLoadingError,
    error,
  } = useProjectResource(projectId, resourceId);

  if (isPending) {
    return <WorkareaLoading />;
  }

  if (isLoadingError) {
    return <WorkareaMessage>{error.message}</WorkareaMessage>;
  }

  return <DocumentEditor projectId={projectId} resource={resource} />;
}

registerWorkareaKind({
  type: "document",
  icon: "FileText",
  keepMounted: true,
  // The row holds the title, and the tab is opened from the row that has it
  // already, so the fallback is only for a target typed in from elsewhere.
  resolveTitle: () => "Document",
  render: (tab, hostProps) => (
    <DocumentWorkareaView tab={tab} projectId={hostProps.projectId} />
  ),
});
