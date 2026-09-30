import { useNavigate } from "@tanstack/react-router";
import { generate } from "random-words";
import { type MouseEvent, type ReactNode, useRef, useState } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import useToastNotification from "@/hooks/useToastNotification";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
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
  const notify = useToastNotification();
  const creating = useRef(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    if (creating.current) return;
    creating.current = true;
    setIsCreating(true);
    const openNewTab = e.ctrlKey || e.metaKey;
    try {
      const name = randomName();
      const componentText = defaultPipelineYamlWithName(name);
      const file = await storage.createPipeline(name, componentText);

      const clickThroughUrl = getDefaultEditorPath(file.referenceId);

      if (openNewTab) {
        window.open(clickThroughUrl, "_blank");
        return;
      }

      navigate({
        to: clickThroughUrl,
        reloadDocument: !IS_GITHUB_PAGES,
      });
    } catch (error) {
      notify(
        `Could not create pipeline: ${error instanceof Error ? error.message : String(error)}`,
        "error",
      );
    } finally {
      creating.current = false;
      setIsCreating(false);
    }
  };

  return (
    <Button
      data-testid="new-pipeline-button"
      {...buttonProps}
      disabled={buttonProps.disabled || isCreating}
      aria-busy={isCreating}
      onClick={handleCreate}
    >
      {children ?? "New Pipeline"}
    </Button>
  );
};

export default NewPipelineButton;
