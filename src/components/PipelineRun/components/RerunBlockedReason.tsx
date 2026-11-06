import { TeamName } from "@/components/shared/Teams/TeamName";
import type { RerunBlock } from "@/routes/v2/pages/RunView/hooks/useRerunPipelineRun";

export function RerunBlockedReason({ block }: { block: RerunBlock }) {
  if (block.kind === "team-unchecked") {
    return <>{"Couldn't check this run's workspace, so it can't be rerun."}</>;
  }
  return (
    <>
      {"This run went as the "}
      <TeamName team={block.team} />
      {" workspace. Only someone who can act as the workspace can rerun it."}
    </>
  );
}
