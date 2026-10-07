import { useState } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";

import { ManageAccessDialog } from "./ManageAccessDialog";
import { useRunPipelineId } from "./useRunPermissions";

export function ManageAccessButton({
  runId,
  className,
}: {
  runId: string | number | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const pipelineId = useRunPipelineId(runId);

  if (!pipelineId) return null;

  return (
    <>
      <ActionButton
        tooltip="Manage pipeline access"
        onClick={() => setOpen(true)}
        icon="Users"
        className={className}
      />
      <ManageAccessDialog
        type="pipeline"
        id={pipelineId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
