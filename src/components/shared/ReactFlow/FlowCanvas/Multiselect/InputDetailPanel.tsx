import type { Node } from "@xyflow/react";

import { InputValueEditor } from "@/components/Editor/IOEditor/InputValueEditor";
import { InfoBox } from "@/components/shared/InfoBox";
import { Paragraph } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { nodeIdToInputName } from "@/utils/nodes/nodeIdUtils";

export const InputDetailPanel = ({
  node,
  readOnly,
}: {
  node: Node;
  readOnly: boolean;
}) => {
  const { currentSubgraphSpec } = useComponentSpec();
  const name = nodeIdToInputName(node.id);
  const input = currentSubgraphSpec.inputs?.find((i) => i.name === name);

  if (!input) {
    return (
      <InfoBox title="Unable to Load Input Details" variant="error">
        <Paragraph size="sm" tone="subdued">
          {`Input "${name}" not found in pipeline spec.`}
        </Paragraph>
      </InfoBox>
    );
  }

  return <InputValueEditor input={input} disabled={readOnly} />;
};
