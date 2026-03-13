import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { StackingControls } from "@/components/shared/ReactFlow/FlowControls/StackingControls";

interface ZIndexEditorProps {
  nodeId: string;
  onChange: (newZIndex: number) => void;
}

export function ZIndexEditor({ nodeId, onChange }: ZIndexEditorProps) {
  return (
    <ContentBlock title="Stacking">
      <StackingControls nodeId={nodeId} onChange={onChange} />
    </ContentBlock>
  );
}
