import { useNavigate } from "@tanstack/react-router";
import { generate } from "random-words";
import type { MouseEvent, ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  getDefaultEditorHref,
  getDefaultEditorTarget,
} from "@/routes/editorRoutes";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  defaultPipelineYamlWithName,
  IS_GITHUB_PAGES,
} from "@/utils/constants";

const randomName = () => (generate(4) as string[]).join(" ");

interface NewPipelineButtonProps extends Omit<ButtonProps, "onClick"> {
  children?: ReactNode;
}

const NewPipelineButton = ({
  children,
  ...buttonProps
}: NewPipelineButtonProps) => {
  const navigate = useNavigate();
  const storage = usePipelineStorage();

  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    const name = randomName();
    const file = await storage.createPipeline(
      name,
      defaultPipelineYamlWithName(name),
    );
    const ref = { name: file.displayName, fileId: file.id };

    if (e.ctrlKey || e.metaKey) {
      window.open(getDefaultEditorHref(ref), "_blank");
      return;
    }

    navigate({
      ...getDefaultEditorTarget(ref),
      reloadDocument: !IS_GITHUB_PAGES,
    });
  };

  return (
    <Button
      data-testid="new-pipeline-button"
      {...buttonProps}
      onClick={handleCreate}
    >
      {children ?? "New Pipeline"}
    </Button>
  );
};

export default NewPipelineButton;
