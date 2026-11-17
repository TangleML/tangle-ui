import { ArtifactViewer } from "@tangent/embed-react";

import { isTextArtifact } from "@/routes/v2/pages/Tangent/services/artifactText";
import { parseIdentity } from "@/services/projects/resourceTarget";

import { registerWorkareaKind } from "./registry";
import { TextArtifactView } from "./TextArtifactView";
import type { WorkareaTab } from "./types";
import { WorkareaMessage } from "./WorkareaPlaceholder";

function ArtifactWorkareaView({
  tab,
  sessionId,
}: {
  tab: WorkareaTab;
  sessionId: string | undefined;
}) {
  const url = parseIdentity(tab.target.identity).value;

  if (isTextArtifact(url)) {
    return <TextArtifactView url={url} title={tab.title} />;
  }

  if (sessionId === undefined) {
    return (
      <WorkareaMessage>Start a session to view this artifact.</WorkareaMessage>
    );
  }
  return (
    <ArtifactViewer
      sessionId={sessionId}
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
