import { ArtifactViewer } from "@tangent/embed-react";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import { sessionIdOfFileUrl } from "@/routes/v2/pages/Tangent/services/sessionFiles";
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
  const url = parseIdentity(tab.target.identity).value;
  // A chat's file is read as that chat's, so its tab shows the same whichever
  // chat is open beside it.
  const owner = sessionIdOfFileUrl(url) ?? sessionId;
  if (owner === undefined) {
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
      sessionId={owner}
      url={url}
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
