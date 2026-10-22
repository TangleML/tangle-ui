import type {
  AnchorProtocolMap,
  AnchorProtocolProps,
} from "@tangent/embed-react";
import type { MouseEvent } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { getRunPath } from "@/routes/runRoutes";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { chatAnchorProtocols } from "@/routes/v2/shared/components/AiChat/components/chatAnchorProtocols";
import { ChatEntityChip } from "@/routes/v2/shared/components/AiChat/components/ChatEntityChip";
import { resourceMeta } from "@/services/projects/resourceMeta";
import type { WorkareaTarget } from "@/services/projects/resourceTarget";
import {
  idIdentity,
  isWorkareaTargetString,
  parseIdentity,
  parseWorkareaTarget,
} from "@/services/projects/resourceTarget";
import { hasNewTabModifier } from "@/utils/dom";
import { getErrorMessage } from "@/utils/string";

function runTarget(path: string): WorkareaTarget | undefined {
  const candidate = `run://${path}`;
  if (isWorkareaTargetString(candidate)) return parseWorkareaTarget(candidate);
  if (path === "" || path.includes("/")) return undefined;
  return { type: "run", identity: idIdentity(path) };
}

function RunAnchor({ path, label }: AnchorProtocolProps) {
  const store = useTangentProject();
  const notify = useToastNotification();
  const target = runTarget(path);
  const newTabHint = target ? "Cmd/Ctrl+click to open in a new tab" : undefined;

  async function openRun() {
    if (!target) return;
    try {
      await store.openWorkareaTarget(target, label);
    } catch (error) {
      notify(getErrorMessage(error), "error");
    }
  }

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (!target) return;
    if (hasNewTabModifier(event)) {
      const runId = parseIdentity(target.identity).value;
      window.open(getRunPath(runId), "_blank");
      return;
    }
    void openRun();
  }

  return (
    <ChatEntityChip
      icon={resourceMeta("run").icon}
      label={label}
      title={newTabHint}
      disabled={!target}
      onClick={handleClick}
    />
  );
}

export const tangentAnchorProtocols: AnchorProtocolMap = {
  ...chatAnchorProtocols,
  run: RunAnchor,
};
