import type { HostUIComponentMap } from "@tangent/embed-react";

import { ChatRunsPill } from "./ChatRunsPill";
import { PipelineProgressCard } from "./PipelineProgressCard";

export const tangentUiComponents: HostUIComponentMap = {
  "pipeline-progress": PipelineProgressCard,
  "composer-pill": ChatRunsPill,
};
