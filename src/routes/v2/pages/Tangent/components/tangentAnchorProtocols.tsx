import type {
  AnchorProtocolMap,
  AnchorProtocolProps,
} from "@tangent/embed-react";

import { useOpenWorkareaTarget } from "@/routes/v2/pages/Tangent/hooks/useOpenWorkareaTarget";
import { chatAnchorProtocols } from "@/routes/v2/shared/components/AiChat/components/chatAnchorProtocols";
import { ChatEntityChip } from "@/routes/v2/shared/components/AiChat/components/ChatEntityChip";
import { resourceMeta } from "@/services/projects/resourceMeta";
import type { WorkareaTarget } from "@/services/projects/resourceTarget";
import {
  idIdentity,
  isWorkareaTargetString,
  parseWorkareaTarget,
} from "@/services/projects/resourceTarget";

function runTarget(path: string): WorkareaTarget | undefined {
  const candidate = `run://${path}`;
  if (isWorkareaTargetString(candidate)) return parseWorkareaTarget(candidate);
  if (path === "" || path.includes("/")) return undefined;
  return { type: "run", identity: idIdentity(path) };
}

function RunAnchor({ path, label }: AnchorProtocolProps) {
  const open = useOpenWorkareaTarget({ fromChat: true });
  const target = runTarget(path);
  const newTabHint = target ? "Cmd/Ctrl+click to open in a new tab" : undefined;

  return (
    <ChatEntityChip
      icon={resourceMeta("run").icon}
      label={label}
      title={newTabHint}
      disabled={!target}
      onClick={(event) => {
        if (target) void open(target, label, event);
      }}
    />
  );
}

/** A pipeline or document someone referenced with `#`, opened in the workarea. */
function WorkareaTargetAnchor({ href, protocol, label }: AnchorProtocolProps) {
  const open = useOpenWorkareaTarget({ fromChat: true });
  const target = isWorkareaTargetString(href)
    ? parseWorkareaTarget(href)
    : undefined;

  return (
    <ChatEntityChip
      icon={
        resourceMeta(protocol === "document" ? "document" : "pipeline").icon
      }
      label={label}
      disabled={!target}
      onClick={() => {
        if (target) void open(target, label);
      }}
    />
  );
}

export const tangentAnchorProtocols: AnchorProtocolMap = {
  ...chatAnchorProtocols,
  run: RunAnchor,
  pipeline: WorkareaTargetAnchor,
  document: WorkareaTargetAnchor,
};
