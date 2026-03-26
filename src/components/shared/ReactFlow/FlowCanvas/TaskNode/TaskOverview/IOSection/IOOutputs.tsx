import type { GetExecutionArtifactsResponse } from "@/api/types.gen";
import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import type { OutputSpec } from "@/utils/componentSpec";

import IOCell from "./IOCell/IOCell";

interface IOOutputsProps {
  outputs?: OutputSpec[];
  artifacts: GetExecutionArtifactsResponse;
}

const IOOutputs = ({ outputs, artifacts }: IOOutputsProps) => {
  return (
    <BlockStack gap="1" className="w-full">
      <Heading level={1}>Outputs</Heading>

      {(!outputs || outputs.length === 0) && (
        <Paragraph tone="subdued" size="xs">
          No outputs defined
        </Paragraph>
      )}

      {outputs?.map((output) => {
        const outputArtifact = artifacts?.output_artifacts?.[output.name];

        return (
          <IOCell
            key={output.name}
            name={output.name}
            type={output.type?.toString()}
            artifact={outputArtifact}
          />
        );
      })}
    </BlockStack>
  );
};

export default IOOutputs;
