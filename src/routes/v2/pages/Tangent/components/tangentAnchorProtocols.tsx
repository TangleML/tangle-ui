import type {
  AnchorProtocolMap,
  AnchorProtocolProps,
} from "@tangent/embed-react";

import useToastNotification from "@/hooks/useToastNotification";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";
import { chatAnchorProtocols } from "@/routes/v2/shared/components/AiChat/components/chatAnchorProtocols";
import { ChatEntityChip } from "@/routes/v2/shared/components/AiChat/components/ChatEntityChip";
import { resourceMeta } from "@/services/projects/resourceMeta";
import type { WorkareaTarget } from "@/services/projects/resourceTarget";
import {
  idIdentity,
  isWorkareaTargetString,
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

  return (
    <ChatEntityChip
      icon={resourceMeta("run").icon}
      label={label}
      disabled={!target}
      onClick={() => void openRun()}
    />
  );
}

export const tangentAnchorProtocols: AnchorProtocolMap = {
  ...chatAnchorProtocols,
  run: RunAnchor,
};
