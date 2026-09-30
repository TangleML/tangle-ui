import { CodeViewer, languageFor } from "@/components/shared/CodeViewer";
import { BlockStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Text } from "@/components/ui/typography";
import { parseIdentity } from "@/services/projects/resourceTarget";
import { useProjectResource } from "@/services/projects/useProjectResources";

import { registerWorkareaKind } from "./registry";
import type { WorkareaTab } from "./types";

const CONTENT_KEY = "content";

function Centered({ children }: { children: string }) {
  return (
    <BlockStack
      gap="1"
      align="center"
      className="min-h-0 flex-1 justify-center p-6 text-center"
    >
      <Text size="sm" tone="subdued">
        {children}
      </Text>
    </BlockStack>
  );
}

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
    return <Centered>{error.message}</Centered>;
  }

  const body = resource.payload?.[CONTENT_KEY];
  if (typeof body !== "string") {
    return <Centered>This document has nothing written in it.</Centered>;
  }

  return (
    <div className="min-h-0 flex-1 overflow-hidden">
      <CodeViewer
        code={body}
        language={languageFor(resource.name)}
        filename={resource.name ?? tab.title}
      />
    </div>
  );
}

registerWorkareaKind({
  type: "document",
  icon: "FileText",
  keepMounted: false,
  // The row holds the title, and the tab is opened from the row that has it
  // already, so the fallback is only for a target typed in from elsewhere.
  resolveTitle: () => "Document",
  render: (tab, hostProps) => (
    <DocumentWorkareaView tab={tab} projectId={hostProps.projectId} />
  ),
});
