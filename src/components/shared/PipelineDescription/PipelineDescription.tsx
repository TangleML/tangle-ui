import type { ComponentSpec } from "@/utils/componentSpec";

import { ContentBlock } from "../ContextPanel/Blocks/ContentBlock";
import { InlineEditor } from "../InlineEditor/InlineEditor";
import { PipelineDescriptionEditor } from "./PipelineDescriptionEditor";

export const PipelineDescription = ({
  componentSpec,
}: {
  componentSpec: ComponentSpec;
}) => {
  const hasDescription = Boolean(
    componentSpec.description && componentSpec.description.trim(),
  );

  if (!hasDescription) {
    return (
      <ContentBlock title="Description">
        <PipelineDescriptionEditor />
      </ContentBlock>
    );
  }

  return (
    <ContentBlock title="Description">
      <InlineEditor
        value={componentSpec.description}
        editor={<PipelineDescriptionEditor autoFocus />}
      />
    </ContentBlock>
  );
};
