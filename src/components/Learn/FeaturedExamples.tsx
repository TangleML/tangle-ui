import { Link } from "@tanstack/react-router";

import { InfoBox } from "@/components/shared/InfoBox";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

import { examplePipelines } from "./ExamplePipelines";
import { PipelineCard } from "./PipelineCard";
import { useImportPipeline } from "./useImportPipeline";

const FEATURED_COUNT = 3;

export function FeaturedExamples() {
  const {
    mutate: importPipeline,
    isPending,
    variables: importingUrl,
    error,
  } = useImportPipeline();
  const featured = examplePipelines.slice(0, FEATURED_COUNT);

  return (
    <BlockStack gap="3">
      <InlineStack gap="3" align="space-between" blockAlign="center">
        <InlineStack gap="2" blockAlign="center">
          <Icon
            name="Presentation"
            size="md"
            className="text-primary"
            aria-hidden="true"
          />
          <Heading level={2}>Example pipelines</Heading>
        </InlineStack>
        <Button
          asChild
          size="sm"
          variant="link"
          className="px-0"
          {...tracking("learning_hub.examples.browse_all")}
        >
          <Link to="/learn/examples">Browse all examples →</Link>
        </Button>
      </InlineStack>

      {!!error && (
        <InfoBox title="Error importing pipeline" variant="error">
          <Paragraph>{error.message}</Paragraph>
        </InfoBox>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {featured.map((pipeline) => (
          <PipelineCard
            key={pipeline.id}
            pipeline={pipeline}
            onClick={() => importPipeline(pipeline.url)}
            isLoading={isPending && importingUrl === pipeline.url}
            isDisabled={isPending}
            variant="compact"
            trackingMetadata={{ surface: "home" }}
          />
        ))}
      </div>
    </BlockStack>
  );
}
