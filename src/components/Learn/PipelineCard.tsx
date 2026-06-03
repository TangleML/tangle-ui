import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InlineStack } from "@/components/ui/layout";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

import type { ExamplePipeline } from "./ExamplePipelines";

type PipelineCardVariant = "default" | "compact";

interface PipelineCardProps {
  pipeline: ExamplePipeline;
  onClick: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  trackingMetadata?: Record<string, unknown>;
  variant?: PipelineCardVariant;
}

const VARIANT_STYLES: Record<
  PipelineCardVariant,
  {
    hover: string;
    titleClass: string;
    descriptionClass: string;
    badgeVariant: "default" | "secondary";
    maxTags?: number;
  }
> = {
  default: {
    hover: "hover:shadow-lg transition-shadow duration-200",
    titleClass: "text-lg line-clamp-2",
    descriptionClass: "line-clamp-3",
    badgeVariant: "default",
  },
  compact: {
    hover:
      "hover:shadow-lg hover:border-primary/40 transition-all duration-200",
    titleClass: "text-base line-clamp-2",
    descriptionClass: "line-clamp-2",
    badgeVariant: "secondary",
    maxTags: 3,
  },
};

export function PipelineCard({
  pipeline,
  onClick,
  isLoading,
  isDisabled,
  trackingMetadata,
  variant = "default",
}: PipelineCardProps) {
  const styles = VARIANT_STYLES[variant];
  const tags =
    styles.maxTags !== undefined
      ? pipeline.tags?.slice(0, styles.maxTags)
      : pipeline.tags;

  return (
    <Card
      className={cn(
        "overflow-hidden cursor-pointer group",
        styles.hover,
        isLoading && "opacity-50",
        (isLoading || isDisabled) && "pointer-events-none",
      )}
      onClick={onClick}
      {...tracking("learning_hub.examples.import", {
        example_id: pipeline.id,
        ...trackingMetadata,
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
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size={20} />
          </div>
        )}
      </div>
      <CardHeader>
        <CardTitle className={styles.titleClass}>{pipeline.name}</CardTitle>
        <CardDescription className={styles.descriptionClass}>
          {pipeline.description}
        </CardDescription>
      </CardHeader>
      {tags && tags.length > 0 && (
        <CardContent>
          <InlineStack gap="1" wrap="wrap" blockAlign="start" align="start">
            {tags.map((tag) => (
              <Badge size="sm" variant={styles.badgeVariant} key={tag}>
                {tag}
              </Badge>
            ))}
          </InlineStack>
        </CardContent>
      )}
    </Card>
  );
}
