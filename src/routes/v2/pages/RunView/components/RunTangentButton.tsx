import { Button } from "@/components/ui/button";
import type { IconName } from "@/components/ui/icon";
import { Icon } from "@/components/ui/icon";
import type {
  RunInTangent,
  RunTangentHandoffState,
} from "@/routes/v2/pages/RunView/hooks/useRunTangentHandoff";
import { useAiGate } from "@/routes/v2/shared/components/AiChat/components/useAiGate";
import { tracking } from "@/utils/tracking";

import { TangentDestinationDialog } from "./TangentDestinationDialog";

interface RunTangentButtonProps {
  run: RunInTangent;
  handoff: RunTangentHandoffState;
  label: string;
  icon: IconName;
  createLabel: string;
  trackingId: string;
}

export function RunTangentButton({
  run,
  handoff,
  label,
  icon,
  createLabel,
  trackingId,
}: RunTangentButtonProps) {
  const aiGate = useAiGate();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        disabled={handoff.isPending || aiGate.disabled}
        title={aiGate.title}
        onClick={() => handoff.start(run)}
        {...tracking(trackingId)}
      >
        <Icon name={icon} size="sm" />
        {handoff.isPending ? "Starting…" : label}
      </Button>

      {handoff.choosing && (
        <TangentDestinationDialog
          title={label}
          createLabel={createLabel}
          attributed={handoff.choosing.attributed}
          newProjectName={handoff.choosing.newProjectName}
          onChoose={handoff.choose}
          onDismiss={handoff.dismiss}
        />
      )}
    </>
  );
}
