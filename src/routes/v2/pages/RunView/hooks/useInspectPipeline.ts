import { useNavigate } from "@tanstack/react-router";

export function useInspectPipeline(inspectPath?: string) {
  const navigate = useNavigate();

  const inspect = () => {
    if (!inspectPath) return;
    navigate({ to: inspectPath });
  };

  return { inspect };
}
