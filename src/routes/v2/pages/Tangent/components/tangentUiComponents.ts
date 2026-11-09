import type { HostUIComponentMap } from "@tangent/embed-react";

import { ChatRunsPill } from "./ChatRunsPill";
import { PipelineProgressCard } from "./PipelineProgressCard";

/**
 * Components this page draws inside Tangent's chat: its own run card for the
 * agent's `tangent-ui:pipeline-progress` blocks, and the runs pill beside the
 * chat's agents.
 */
export const tangentUiComponents: HostUIComponentMap = {
  "pipeline-progress": PipelineProgressCard,
  "composer-pill": ChatRunsPill,
};
