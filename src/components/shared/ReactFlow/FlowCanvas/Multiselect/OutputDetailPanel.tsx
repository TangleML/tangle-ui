import type { Node } from "@xyflow/react";

import { OutputNameEditor } from "@/components/Editor/IOEditor/OutputNameEditor";
import { getOutputConnectedDetails } from "@/components/Editor/utils/getOutputConnectedDetails";
import { InfoBox } from "@/components/shared/InfoBox";
import { Paragraph } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { nodeIdToOutputName } from "@/utils/nodes/nodeIdUtils";

export const OutputDetailPanel = ({
  node,
  readOnly,
}: {
  node: Node;
  readOnly: boolean;
}) => {
  const { currentSubgraphSpec, currentGraphSpec } = useComponentSpec();
  const name = nodeIdToOutputName(node.id);
  const output = currentSubgraphSpec.outputs?.find((o) => o.name === name);

  if (!output) {
    return (
      <InfoBox title="Unable to Load Output Details" variant="error">
        <Paragraph size="sm" tone="subdued">
          {`Output "${name}" not found in pipeline spec.`}
        </Paragraph>
      </InfoBox>
    );
  }

  const connectedDetails = getOutputConnectedDetails(currentGraphSpec, name);

  return (
    <OutputNameEditor
      output={output}
      disabled={readOnly}
      connectedDetails={connectedDetails}
    />
  );
};
