import { ArtifactViewer } from "@tangent/embed-react";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { parseIdentity } from "@/services/projects/resourceTarget";

import { registerWorkareaKind } from "./registry";
import type { WorkareaTab } from "./types";

function ArtifactWorkareaView({
  tab,
  sessionId,
}: {
  tab: WorkareaTab;
  sessionId: string | undefined;
}) {
  if (sessionId === undefined) {
    return (
      <BlockStack
        gap="1"
        align="center"
        className="min-h-0 flex-1 justify-center p-6 text-center"
      >
        <Text size="sm" tone="subdued">
          Start a session to view this artifact.
        </Text>
      </BlockStack>
    );
  }
  return (
    <ArtifactViewer
      sessionId={sessionId}
      url={parseIdentity(tab.target.identity).value}
      title={tab.title}
      className="min-h-0 flex-1"
      style={{ height: "100%" }}
    />
  );
}

registerWorkareaKind({
  type: "artifact",
  icon: "FileText",
  keepMounted: false,
  resolveTitle: (target) => parseIdentity(target.identity).value,
  render: (tab, hostProps) => (
    <ArtifactWorkareaView tab={tab} sessionId={hostProps.sessionId} />
  ),
});
