import { useNavigate } from "@tanstack/react-router";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { IS_GITHUB_PAGES } from "@/utils/constants";
import { createNewPipeline } from "@/utils/createNewPipeline";

const NewPipelineButton = () => {
  const navigate = useNavigate();

  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    const clickThroughUrl = await createNewPipeline();

    if (e.ctrlKey || e.metaKey) {
      window.open(clickThroughUrl, "_blank");
      return;
    }

    navigate({
      to: clickThroughUrl,
      reloadDocument: !IS_GITHUB_PAGES,
    });
  };

  return (
    <Button
      variant="outline"
      onClick={handleCreate}
      data-testid="new-pipeline-button"
    >
      <Icon name="FilePlusCorner" /> New Pipeline
    </Button>
  );
};

export default NewPipelineButton;
