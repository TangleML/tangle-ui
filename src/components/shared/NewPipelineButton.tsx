import { useNavigate } from "@tanstack/react-router";
import { generate } from "random-words";
import type { MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { EDITOR_PATH } from "@/routes/router";
import { writeComponentToFileListFromText } from "@/utils/componentStore";
import {
  defaultPipelineYamlWithName,
  IS_GITHUB_PAGES,
  USER_PIPELINES_LIST_NAME,
} from "@/utils/constants";

const randomName = () => (generate(4) as string[]).join(" ");

const NewPipelineButton = () => {
  const navigate = useNavigate();

  const handleCreate = async (e: MouseEvent<HTMLButtonElement>) => {
    const name = randomName();
    const componentText = defaultPipelineYamlWithName(name);
    await writeComponentToFileListFromText(
      USER_PIPELINES_LIST_NAME,
      name,
      componentText,
    );

    const clickThroughUrl = `${EDITOR_PATH}/${encodeURIComponent(name)}`;

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
      New Pipeline
    </Button>
  );
};

export default NewPipelineButton;
