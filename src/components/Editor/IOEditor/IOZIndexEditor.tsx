import { ContentBlock } from "@/components/shared/ContextPanel/Blocks/ContentBlock";
import { StackingControls } from "@/components/shared/ReactFlow/FlowControls/StackingControls";
import { useComponentSpec } from "@/providers/ComponentSpecProvider";
import { ZINDEX_ANNOTATION } from "@/utils/annotations";
import {
  type ComponentSpec,
  type InputSpec,
  type OutputSpec,
} from "@/utils/componentSpec";
import {
  inputNameToNodeId,
  outputNameToNodeId,
} from "@/utils/nodes/nodeIdUtils";
import { updateSubgraphSpec } from "@/utils/subgraphUtils";

interface IOZIndexEditorProps {
  ioSpec: InputSpec | OutputSpec;
  ioType: "input" | "output";
}

export const IOZIndexEditor = ({ ioSpec, ioType }: IOZIndexEditorProps) => {
  const {
    componentSpec,
    currentSubgraphSpec,
    currentSubgraphPath,
    setComponentSpec,
  } = useComponentSpec();

  const isInput = ioType === "input";

  const nodeId = isInput
    ? inputNameToNodeId(ioSpec.name)
    : outputNameToNodeId(ioSpec.name);

  const handleStackingControlChange = (newZIndex: number) => {
    const updatedSubgraphSpec = setZIndexInAnnotations(
      currentSubgraphSpec,
      ioSpec,
      ioType,
      newZIndex,
    );

    const newRootSpec = updateSubgraphSpec(
      componentSpec,
      currentSubgraphPath,
      updatedSubgraphSpec,
    );

    setComponentSpec(newRootSpec);
  };

  return (
    <ContentBlock className="border rounded-lg p-2 bg-background w-fit mx-auto">
      <StackingControls
        nodeId={nodeId}
        onChange={handleStackingControlChange}
      />
    </ContentBlock>
  );
};

function setZIndexInAnnotations(
  componentSpec: ComponentSpec,
  ioSpec: InputSpec | OutputSpec,
  ioType: "input" | "output",
  zIndex: number,
): ComponentSpec {
  const newComponentSpec = { ...componentSpec };

  const isInput = ioType === "input";
  const isOutput = ioType === "output";

  if (isInput) {
    const inputs = [...(newComponentSpec.inputs || [])];
    const inputIndex = inputs.findIndex((input) => input.name === ioSpec.name);

    if (inputIndex >= 0) {
      const annotations = inputs[inputIndex].annotations || {};

      const updatedAnnotations = {
        ...annotations,
        [ZINDEX_ANNOTATION]: `${zIndex}`,
      };

      inputs[inputIndex] = {
        ...inputs[inputIndex],
        annotations: updatedAnnotations,
      };

      newComponentSpec.inputs = inputs;
    }
  } else if (isOutput) {
    const outputs = [...(newComponentSpec.outputs || [])];
    const outputIndex = outputs.findIndex(
      (output) => output.name === ioSpec.name,
    );

    if (outputIndex >= 0) {
      const annotations = outputs[outputIndex].annotations || {};

      const updatedAnnotations = {
        ...annotations,
        [ZINDEX_ANNOTATION]: `${zIndex}`,
      };

      outputs[outputIndex] = {
        ...outputs[outputIndex],
        annotations: updatedAnnotations,
      };

      newComponentSpec.outputs = outputs;
    }
  }

  return newComponentSpec;
}
