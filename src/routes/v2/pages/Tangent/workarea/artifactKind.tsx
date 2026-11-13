import { ArtifactViewer } from "@tangent/embed-react";

import { BlockStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";
import {
  isTangentSessionUrl,
  sessionIdOfFileUrl,
} from "@/routes/v2/pages/Tangent/services/sessionFiles";
import { parseIdentity } from "@/services/projects/resourceTarget";

import { registerWorkareaKind } from "./registry";
import type { WorkareaTab } from "./types";

function ArtifactNotice({ children }: { children: string }) {
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

function ArtifactWorkareaView({
  tab,
  sessionId,
  tangentBaseUrl,
}: {
  tab: WorkareaTab;
  sessionId: string | undefined;
  tangentBaseUrl: string | null | undefined;
}) {
  const url = parseIdentity(tab.target.identity).value;
  // The viewer loads whatever its address serves, so an address that isn't
  // this Tangent's own is never handed to it, however the tab came to be.
  if (!tangentBaseUrl || !isTangentSessionUrl(url, tangentBaseUrl)) {
    return (
      <ArtifactNotice>
        This file isn&apos;t from one of this project&apos;s chats, so it
        can&apos;t be shown here.
      </ArtifactNotice>
    );
  }
  // A chat's file is read as that chat's, so its tab shows the same whichever
  // chat is open beside it.
  const owner = sessionIdOfFileUrl(url, tangentBaseUrl) ?? sessionId;
  if (owner === undefined) {
    return (
      <ArtifactNotice>Start a session to view this artifact.</ArtifactNotice>
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
    <ArtifactWorkareaView
      tab={tab}
      sessionId={hostProps.sessionId}
      tangentBaseUrl={hostProps.tangentBaseUrl}
    />
  ),
});
