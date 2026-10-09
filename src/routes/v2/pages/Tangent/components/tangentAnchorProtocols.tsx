import type {
  AnchorProtocolMap,
  AnchorProtocolProps,
} from "@tangent/embed-react";
import type { MouseEvent } from "react";

import useToastNotification from "@/hooks/useToastNotification";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import {
  openRunPageInNewTab,
  requestsNewTab,
} from "@/routes/v2/pages/Tangent/services/openRunPageInNewTab";
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
    if (requestsNewTab(event)) {
      openRunPageInNewTab(parseIdentity(target.identity).value);
      return;
    }
    void openRun();
  }

  return (
    <ChatEntityChip
      icon={resourceMeta("run").icon}
      label={label}
      title={target ? "Cmd/Ctrl+click to open in a new tab" : undefined}
      disabled={!target}
      onClick={handleClick}
    />
  );
}

export const tangentAnchorProtocols: AnchorProtocolMap = {
  ...chatAnchorProtocols,
  run: RunAnchor,
};
