import { useNavigate } from "@tanstack/react-router";
import { generate } from "random-words";
import type { MouseEvent, ReactNode } from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  getDefaultEditorHref,
  getDefaultEditorTarget,
} from "@/routes/editorRoutes";
import { writeComponentToFileListFromText } from "@/utils/componentStore";
import {
  defaultPipelineYamlWithName,
  IS_GITHUB_PAGES,
  USER_PIPELINES_LIST_NAME,
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

  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    const name = randomName();
    const componentText = defaultPipelineYamlWithName(name);
    await writeComponentToFileListFromText(
      USER_PIPELINES_LIST_NAME,
      name,
      componentText,
    );

    if (e.ctrlKey || e.metaKey) {
      window.open(getDefaultEditorHref({ name }), "_blank");
      return;
    }

    navigate({
      ...getDefaultEditorTarget({ name }),
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
