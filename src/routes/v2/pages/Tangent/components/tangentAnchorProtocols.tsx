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
  isRunOrExecutionId,
  isWorkareaTargetString,
  parseWorkareaTarget,
} from "@/services/projects/resourceTarget";

function runTarget(path: string): WorkareaTarget | undefined {
  const candidate = `run://${path}`;
  if (isWorkareaTargetString(candidate)) return parseWorkareaTarget(candidate);
  if (!isRunOrExecutionId(path)) return undefined;
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

const PERCENT_ESCAPES = /(?:%[0-9a-f]{2})+/gi;

// The chat draws agent messages and slash-command results as markdown, which
// percent-encodes a link's address, so a name with a space arrives as `%20`;
// a person's own message hands the address over as typed. Runs of escapes are
// decoded one at a time, since a stray `%`, as in "50%off", makes decoding
// the whole address at once fail.
function decodedLinkAddress(href: string): string {
  return href.replace(PERCENT_ESCAPES, (escapes) => {
    try {
      return decodeURIComponent(escapes);
    } catch {
      return escapes;
    }
  });
}

function WorkareaTargetAnchor({ href, protocol, label }: AnchorProtocolProps) {
  const open = useOpenWorkareaTarget({ fromChat: true });
  const address = decodedLinkAddress(href);
  const target = isWorkareaTargetString(address)
    ? parseWorkareaTarget(address)
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
