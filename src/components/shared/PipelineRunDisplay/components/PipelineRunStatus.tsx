import StatusIcon from "@/components/shared/Status/StatusIcon";
import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Spinner } from "@/components/ui/spinner";
import type { PipelineRun } from "@/types/pipelineRun";

import { usePipelineRunStatus } from "../usePipelineRunStatus";

export const PipelineRunStatus = withSuspenseWrapper(
  ({ run }: { run: PipelineRun }) => {
    const { data: status } = usePipelineRunStatus(run);

    return <StatusIcon status={status} />;
  },
  () => <Spinner size={20} />,
  () => <StatusIcon status="UNKNOWN" />,
);
