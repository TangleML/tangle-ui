import { useNavigate } from "@tanstack/react-router";
import { generate } from "random-words";
import type { MouseEvent, ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { useNewPipelineDraft } from "@/hooks/useNewPipelineDraft";
import useToastNotification from "@/hooks/useToastNotification";
import { getDefaultEditorPath } from "@/routes/editorRoutes";
import { usePipelineStorage } from "@/services/pipelineStorage/PipelineStorageProvider";
import {
  defaultPipelineYamlWithName,
  IS_GITHUB_PAGES,
} from "@/utils/constants";
import { hasNewTabModifier } from "@/utils/dom";

const randomName = () => (generate(4) as string[]).join(" ");

interface NewPipelineButtonProps extends Omit<ButtonProps, "onClick"> {
  children?: ReactNode;
}

const NewPipelineButton = ({
  children,
  ...buttonProps
}: NewPipelineButtonProps) => {
  const navigate = useNavigate();
  const newDraft = useNewPipelineDraft();
  const storage = usePipelineStorage();
  const notify = useToastNotification();

  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    try {
      const name = randomName();
      const draft = newDraft(name);
      if (draft) {
        if (hasNewTabModifier(e)) window.open(draft.to, "_blank");
        else await navigate(draft);
        return;
      }
      const componentText = defaultPipelineYamlWithName(name);
      await storage.rootFolder.addFile(name, componentText);

      const clickThroughUrl = getDefaultEditorPath(name);

      if (hasNewTabModifier(e)) {
        window.open(clickThroughUrl, "_blank");
        return;
      }

      navigate({
        to: clickThroughUrl,
        reloadDocument: !IS_GITHUB_PAGES,
      });
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Unable to create pipeline",
        "error",
      );
    }
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
