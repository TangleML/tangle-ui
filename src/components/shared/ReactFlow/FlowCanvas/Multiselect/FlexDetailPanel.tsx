import type { Node } from "@xyflow/react";

import { InfoBox } from "@/components/shared/InfoBox";
import { Paragraph } from "@/components/ui/typography";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";

import { FlexNodeEditor } from "../FlexNode/FlexNodeEditor";
import { getFlexNode } from "../FlexNode/interface";

export const FlexDetailPanel = ({
  node,
  readOnly,
}: {
  node: Node;
  readOnly: boolean;
}) => {
  const { currentSubgraphSpec } = useComponentSpec();
  const flexNode = getFlexNode(node.id, currentSubgraphSpec);

  if (!flexNode) {
    return (
      <InfoBox title="Unable to Load Sticky Note Details" variant="error">
        <Paragraph size="sm" tone="subdued">
          Invalid data for Sticky Note.
        </Paragraph>
      </InfoBox>
    );
  }

  return <FlexNodeEditor flexNode={flexNode} readOnly={readOnly} />;
};
