import { InfoBox } from "@/components/shared/InfoBox";
import { BlockStack } from "@/components/ui/layout";
import { Paragraph } from "@/components/ui/typography";
import { publicAsset } from "@/utils/publicAsset";

import examplePipelinesData from "./examplePipelines.json";
import { PipelineCard } from "./PipelineCard";
import { useImportPipeline } from "./useImportPipeline";

export interface ExamplePipeline {
  id: string;
  name: string;
  description: string;
  url: string;
  previewImage?: string;
  tags?: string[];
}

export const examplePipelines: ExamplePipeline[] = (
  examplePipelinesData as ExamplePipeline[]
).map((pipeline) => ({
  ...pipeline,
  url: publicAsset(pipeline.url),
  previewImage: pipeline.previewImage
    ? publicAsset(pipeline.previewImage)
    : undefined,
}));

interface ExamplePipelinesProps {
  limit?: number;
}

export function ExamplePipelines({ limit }: ExamplePipelinesProps) {
  const {
    mutate: importPipeline,
    isPending,
    variables: importingUrl,
    error,
  } = useImportPipeline();
  const pipelines = limit ? examplePipelines.slice(0, limit) : examplePipelines;

  return (
    <BlockStack gap="4">
      {!!error && (
        <InfoBox title="Error importing pipeline" variant="error">
          <Paragraph>{error.message}</Paragraph>
        </InfoBox>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {pipelines.map((pipeline) => (
          <PipelineCard
            key={pipeline.id}
            pipeline={pipeline}
            onClick={() => importPipeline(pipeline.url)}
            isLoading={isPending && importingUrl === pipeline.url}
            isDisabled={isPending}
          />
        ))}
      </div>

      {pipelines.length === 0 && (
        <InfoBox title="No example pipelines available." variant="error">
          <Paragraph>Error loading example pipelines.</Paragraph>
        </InfoBox>
      )}
    </BlockStack>
  );
}
