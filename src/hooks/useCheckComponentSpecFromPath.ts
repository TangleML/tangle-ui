import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { buildTaskSpecShape } from "@/components/shared/PipelineRunNameTemplate/types";
import { useExecutionDataOptional } from "@/providers/ExecutionDataProvider";
import { RUNS_BASE_PATH } from "@/routes/router";
import { loadPipelineByName } from "@/services/pipelineService";
import { extractCanonicalName } from "@/utils/canonicalPipelineName";
import type { ComponentSpec } from "@/utils/componentSpec";
import { HOURS } from "@/utils/constants";
import { getIdOrTitleFromPath } from "@/utils/URL";

export const useCheckComponentSpecFromPath = (
  url: string,
  componentSpec: ComponentSpec,
) => {
  const details = useExecutionDataOptional();
  const isRunPath = url.includes(RUNS_BASE_PATH);
  const isEmptyPath = url.trim() === "" || url.trim() === "/";

  const { title } = useMemo(() => getIdOrTitleFromPath(url), [url]);

  const pipelineName =
    extractCanonicalName(
      buildTaskSpecShape(details?.rootDetails?.task_spec, componentSpec),
    ) ?? title;

  const disabled = !componentSpec.name;

  const { data: existsLocal } = useQuery({
    queryKey: ["component-spec-local", url],
    queryFn: async () =>
      loadPipelineByName(pipelineName as string).then(
        (result) => !!result.experiment?.componentRef?.spec,
      ),
    enabled: !disabled && !isRunPath && !!title && !isEmptyPath,
    staleTime: 24 * HOURS,
  });

  return existsLocal ?? false;
};
