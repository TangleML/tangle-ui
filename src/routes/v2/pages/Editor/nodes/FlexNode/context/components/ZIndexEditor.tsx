import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { StackingControls } from "@/components/shared/ReactFlow/FlowControls/StackingControls";

interface ZIndexEditorProps {
  nodeId: string;
  title?: string;
  onChange: (newZIndex: number) => void;
}

export function ZIndexEditor({
  nodeId,
  title = "Stacking",
  onChange,
}: ZIndexEditorProps) {
  return (
    <ContentBlock title={title}>
      <StackingControls
        nodeId={nodeId}
        onChange={onChange}
        trackingBase="v2.pipeline_editor.flex_node_details.z_index"
      />
    </ContentBlock>
  );
}
