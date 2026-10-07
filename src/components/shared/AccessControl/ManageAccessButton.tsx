import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { ActionButton } from "@/components/shared/Buttons/ActionButton";

import { getMyScopes } from "./accessControlApi";
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
  const { data: scopes = [] } = useQuery({
    queryKey: ["access_control", "pipeline", pipelineId, "my_scopes"],
    queryFn: () => getMyScopes("pipeline", String(pipelineId)),
    enabled: !!pipelineId,
    retry: false,
    staleTime: 60_000,
  });

  if (!pipelineId || scopes.length === 0) return null;

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
