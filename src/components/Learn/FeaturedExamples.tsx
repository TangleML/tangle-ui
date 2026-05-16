import { Link } from "@tanstack/react-router";

import { InfoBox } from "@/components/shared/InfoBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Heading, Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

import { examplePipelines } from "./ExamplePipelines";
import { useImportPipeline } from "./useImportPipeline";

const FEATURED_COUNT = 3;

export function FeaturedExamples() {
  const { mutate: importPipeline, isPending, error } = useImportPipeline();
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
          <Card
            key={pipeline.id}
            className={cn(
              "overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all duration-200 cursor-pointer group",
              isPending && "opacity-50 pointer-events-none",
            )}
            onClick={() => importPipeline(pipeline.url)}
            {...tracking("learning_hub.examples.import", {
              example_id: pipeline.id,
              surface: "home",
            })}
          >
            <div className="aspect-video relative bg-linear-to-br from-gray-100 to-gray-200 overflow-hidden">
              {pipeline.previewImage && (
                <img
                  src={pipeline.previewImage}
                  alt={pipeline.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )}
              {isPending && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner size={20} />
                </div>
              )}
            </div>
            <CardHeader>
              <CardTitle className="text-base line-clamp-2">
                {pipeline.name}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {pipeline.description}
              </CardDescription>
            </CardHeader>
            {pipeline.tags && pipeline.tags.length > 0 && (
              <CardContent>
                <InlineStack gap="1" wrap="wrap">
                  {pipeline.tags.slice(0, 3).map((tag) => (
                    <Badge size="sm" variant="secondary" key={tag}>
                      {tag}
                    </Badge>
                  ))}
                </InlineStack>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </BlockStack>
  );
}
