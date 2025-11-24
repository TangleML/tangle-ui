import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

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
import useToastNotification from "@/hooks/useToastNotification";
import { cn } from "@/lib/utils";
import { EDITOR_PATH } from "@/routes/router";

import { importPipelineFromUrl } from "./importPipelineFromUrl";
import { type SamplePipeline, samplePipelines } from "./samplePipelines";

const QuickStartCards = () => {
  const navigate = useNavigate();
  const notify = useToastNotification();

  const {
    mutate: importPipeline,
    isPending,
    error,
  } = useMutation({
    mutationFn: async (url: string) => await importPipelineFromUrl(url),
    onSuccess: (result) => {
      notify(`Pipeline "${result.name}" created successfully`, "success");
      navigate({
        to: `${EDITOR_PATH}/${encodeURIComponent(result.name)}`,
      });
    },
  });

  return (
    <BlockStack>
      {!!error && (
        <InfoBox title="Error importing pipeline" variant="error">
          <Paragraph>{error.message}</Paragraph>
        </InfoBox>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {samplePipelines.map((pipeline: SamplePipeline) => (
          <Card
            key={pipeline.name}
            className={cn(
              "overflow-hidden hover:shadow-lg transition-shadow duration-200 cursor-pointer group",
              isPending && "opacity-50 pointer-events-none",
            )}
            onClick={() => importPipeline(pipeline.url)}
          >
            <div className="aspect-video relative bg-linear-to-br from-gray-100 to-gray-200 overflow-hidden">
              <img
                src={pipeline.previewImage}
                alt={pipeline.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                onError={(e) => {
                  // If image fails to load, hide it and show fallback gradient
                  e.currentTarget.style.display = "none";
                }}
              />
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
            <CardContent>
              {pipeline.tags && pipeline.tags.length > 0 && (
                <InlineStack
                  gap="1"
                  wrap="wrap"
                  blockAlign="start"
                  align="start"
                >
                  {pipeline.tags.map((tag: string) => (
                    <Badge size="sm" key={tag}>
                      {tag}
                    </Badge>
                  ))}
                </InlineStack>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {samplePipelines.length === 0 && (
        <InfoBox title="No sample pipelines available yet." variant="info">
          <Paragraph>No sample pipelines available yet.</Paragraph>
        </InfoBox>
      )}
    </BlockStack>
  );
};

export default QuickStartCards;
