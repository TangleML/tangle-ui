import { DocumentEditor } from "@/components/Project/DocumentEditor";
import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { parseIdentity } from "@/services/projects/resourceTarget";
import { useProjectResource } from "@/services/projects/useProjectResources";

import { registerWorkareaKind } from "./registry";
import type { WorkareaTab } from "./types";

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
    error,
  } = useProjectResource(projectId, resourceId);

  if (isPending) {
    return (
      <BlockStack
        gap="1"
        align="center"
        className="min-h-0 flex-1 justify-center p-6"
      >
        <Spinner />
      </BlockStack>
    );
  }

  if (error) {
    return (
      <BlockStack
        gap="1"
        align="center"
        className="min-h-0 flex-1 justify-center p-6 text-center"
      >
        <Text size="sm" tone="subdued">
          {error.message}
        </Text>
      </BlockStack>
    );
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
