import { InfoBox } from "@/components/shared/InfoBox";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { Paragraph } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { publicAsset } from "@/utils/publicAsset";
import { tracking } from "@/utils/tracking";

import examplePipelinesData from "./examplePipelines.json";
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
  const { mutate: importPipeline, isPending, error } = useImportPipeline();
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
          <Card
            key={pipeline.id}
            className={cn(
              "overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer group",
              isPending && "opacity-50 pointer-events-none",
            )}
            onClick={() => importPipeline(pipeline.url)}
            {...tracking("learning_hub.examples.import", {
              example_id: pipeline.id,
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
              <CardTitle className="text-lg line-clamp-2">
                {pipeline.name}
              </CardTitle>
              <CardDescription className="line-clamp-3">
                {pipeline.description}
              </CardDescription>
            </CardHeader>
            {pipeline.tags && pipeline.tags.length > 0 && (
              <CardContent>
                <InlineStack
                  gap="1"
                  wrap="wrap"
                  blockAlign="start"
                  align="start"
                >
                  {pipeline.tags.map((tag) => (
                    <Badge size="sm" key={tag}>
                      {tag}
                    </Badge>
                  ))}
                </InlineStack>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {pipelines.length === 0 && (
        <InfoBox title="No example pipelines available yet." variant="info">
          <Paragraph>No example pipelines available yet.</Paragraph>
        </InfoBox>
      )}
    </BlockStack>
  );
}
