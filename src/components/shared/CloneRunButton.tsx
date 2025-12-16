import { useLocation, useNavigate, useParams } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RUNS_BASE_PATH } from "@/routes/router";
import { copyRunToPipeline } from "@/services/pipelineRunService";
import type { ComponentSpec } from "@/utils/componentSpec";
import { getInitialName } from "@/utils/getComponentName";

const CloneRunButton = ({
  componentSpec,
}: {
  componentSpec?: ComponentSpec;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams({ strict: false });

  const isRunDetailRoute = location.pathname.includes(RUNS_BASE_PATH);

  const runId =
    "id" in params && typeof params.id === "string" ? params.id : undefined;

  const handleClone = async () => {
    if (!componentSpec) {
      console.error("No component spec found");
      return;
    }

    const name = getInitialName(componentSpec);

    const result = await copyRunToPipeline(componentSpec, runId, name);
    if (result?.url) {
      navigate({ to: result.url });
    } else {
      console.error("Failed to copy run to pipeline");
    }
  };

  if (!isRunDetailRoute) {
    return null;
  }

  if (!componentSpec) {
    return (
      <button>
        <Loader2 className="w-4 h-4 animate-spin" />
      </button>
    );
  }

  return (
    <Button variant="outline" onClick={handleClone}>
      Clone Pipeline
    </Button>
  );
};

export default CloneRunButton;
