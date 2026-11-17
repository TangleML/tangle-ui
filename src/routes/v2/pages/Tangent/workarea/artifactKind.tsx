import { ArtifactViewer } from "@tangent/embed-react";

import { isTextArtifact } from "@/routes/v2/pages/Tangent/services/artifactText";
import {
  isTangentSessionUrl,
  sessionIdOfFileUrl,
} from "@/routes/v2/pages/Tangent/services/sessionFiles";
import { parseIdentity } from "@/services/projects/resourceTarget";

import { registerWorkareaKind } from "./registry";
import { TextArtifactView } from "./TextArtifactView";
import type { WorkareaTab } from "./types";
import { WorkareaMessage } from "./WorkareaPlaceholder";

function ArtifactWorkareaView({
  tab,
  sessionId,
  tangentBaseUrl,
}: {
  tab: WorkareaTab;
  sessionId: string | undefined;
  tangentBaseUrl: string | null;
}) {
  const url = parseIdentity(tab.target.identity).value;
  // Every file tab ends up here however it came to be, so its address is
  // checked once more before either viewer loads it.
  if (!tangentBaseUrl || !isTangentSessionUrl(url, tangentBaseUrl)) {
    return (
      <WorkareaMessage>
        This file isn&apos;t from one of this project&apos;s chats, so it
        can&apos;t be shown here.
      </WorkareaMessage>
    );
  }
  if (isTextArtifact(url)) {
    return <TextArtifactView url={url} title={tab.title} />;
  }
  // A chat's file is read as that chat's, so its tab shows the same whichever
  // chat is open beside it.
  const owner = sessionIdOfFileUrl(url, tangentBaseUrl) ?? sessionId;
  if (owner === undefined) {
    return (
      <WorkareaMessage>Start a session to view this artifact.</WorkareaMessage>
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
