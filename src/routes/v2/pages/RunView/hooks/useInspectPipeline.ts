import { useNavigate } from "@tanstack/react-router";

export function useInspectPipeline(pipelineName?: string) {
  const navigate = useNavigate();

  const inspect = () => {
    if (!pipelineName) return;
    navigate({ to: `/editor/${encodeURIComponent(pipelineName)}` });
  };

  return { inspect };
}
