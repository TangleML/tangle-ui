import { ArtifactViewer } from "@tangent/embed-react";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

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
      url={tab.url}
      title={tab.title}
      className="min-h-0 flex-1"
      style={{ height: "100%" }}
    />
  );
}

registerWorkareaKind({
  kind: "artifact",
  icon: "FileText",
  keepMounted: false,
  render: (tab, hostProps) => (
    <ArtifactWorkareaView tab={tab} sessionId={hostProps.sessionId} />
  ),
});
