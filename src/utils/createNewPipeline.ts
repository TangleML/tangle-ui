import { generate } from "random-words";

import { EDITOR_PATH } from "@/routes/router";

import { writeComponentToFileListFromText } from "./componentStore";
import {
  defaultPipelineYamlWithName,
  USER_PIPELINES_LIST_NAME,
} from "./constants";

const randomName = () => (generate(4) as string[]).join(" ");

export const createNewPipeline = async () => {
  const name = randomName();
  const componentText = defaultPipelineYamlWithName(name);
  await writeComponentToFileListFromText(
    USER_PIPELINES_LIST_NAME,
    name,
    componentText,
  );

  const clickThroughUrl = `${EDITOR_PATH}/${encodeURIComponent(name)}`;

  return clickThroughUrl;
};
