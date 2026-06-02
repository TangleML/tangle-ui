import { BlockStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import type { TangentPipeline } from "@/routes/tangent/types";

interface TangentAnalysisProps {
  pipeline: TangentPipeline;
}

export function TangentAnalysis({ pipeline }: TangentAnalysisProps) {
  return (
    <BlockStack gap="3">
      <Heading level={2}>Tangent Analysis</Heading>
      {pipeline.analyzing ? (
        <Paragraph size="sm" tone="subdued">
          ◎ Analyzing pipeline with Claude — this takes a few seconds…
        </Paragraph>
      ) : pipeline.summary ? (
        <BlockStack gap="2">
          {pipeline.summary.split("\n\n").map((paragraph, index) => (
            <Paragraph key={index} size="sm">
              {paragraph}
            </Paragraph>
          ))}
        </BlockStack>
      ) : (
        <Paragraph size="sm" tone="subdued">
          No analysis yet. Click Re-analyze in the top nav to have the Tangent
          Researcher evaluate this pipeline.
        </Paragraph>
      )}
    </BlockStack>
  );
}
