import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useTourCompletion } from "@/providers/TourProvider/tourCompletion";
import { resetAllTourPipelineState } from "@/providers/TourProvider/tourPipelineStorage/resetAllTourPipelineState";
import { APP_ROUTES } from "@/routes/router";
import { tracking } from "@/utils/tracking";

import { tours as tourCards } from "./tours";
import { getTour } from "./tours/registry";

interface FeaturedTour {
  id: string;
  title: string;
  duration: string;
  tag?: "new" | "popular";
  available: boolean;
}

const FEATURED_TOUR_IDS: Array<Pick<FeaturedTour, "id" | "tag">> = [
  { id: "navigating-the-editor", tag: "new" },
  { id: "first-pipeline", tag: "popular" },
  { id: "using-secrets" },
  { id: "multinode-tasks" },
];

function buildFeaturedTours(): FeaturedTour[] {
  return FEATURED_TOUR_IDS.flatMap(({ id, tag }) => {
    const card = tourCards.find((c) => c.id === id);
    if (!card) return [];
    return [
      {
        id,
        title: card.title,
        duration: card.duration,
        tag,
        available: getTour(id) !== undefined,
      },
    ];
  });
}

export function FeaturedTours() {
  const featured = buildFeaturedTours();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const startTour = (tourId: string) => {
    resetAllTourPipelineState(queryClient);
    void navigate({ to: APP_ROUTES.TOUR_DETAIL, params: { tourId } });
  };

  return (
    <div className="h-full rounded-xl border border-border bg-card p-5 max-w-160">
      <BlockStack gap="3" className="h-full">
        <InlineStack gap="2" blockAlign="center" align="space-between">
          <InlineStack gap="2" blockAlign="center">
            <Icon
              name="Compass"
              size="md"
              className="text-primary"
              aria-hidden="true"
            />
            <Heading level={3}>Featured tours</Heading>
          </InlineStack>
          <Button
            asChild
            size="sm"
            variant="link"
            className="px-0"
            {...tracking("learning_hub.tours.browse_all")}
          >
            <Link to="/learn/tours">All tours →</Link>
          </Button>
        </InlineStack>

        <BlockStack gap="1">
          {featured.map((tour) => (
            <FeaturedTourButton
              key={tour.id}
              tour={tour}
              onStart={() => startTour(tour.id)}
            />
          ))}
        </BlockStack>
      </BlockStack>
    </div>
  );
}

function FeaturedTourButton({
  tour,
  onStart,
}: {
  tour: FeaturedTour;
  onStart: () => void;
}) {
  const completed = useTourCompletion(tour.id);

  return (
    <Button
      variant="ghost"
      size="lg"
      disabled={!tour.available}
      onClick={onStart}
      className="h-auto min-h-10 w-full justify-start whitespace-normal py-2 text-left"
      {...tracking("learning_hub.tours.start", {
        tour_id: tour.id,
        is_restart: completed,
      })}
    >
      <InlineStack
        gap="4"
        align="space-between"
        blockAlign="center"
        wrap="nowrap"
        fill
      >
        <FeaturedTourLabel tour={tour} completed={completed} />
        <Icon
          name={completed ? "RotateCcw" : "Play"}
          size="sm"
          className="text-muted-foreground shrink-0"
          aria-hidden="true"
        />
      </InlineStack>
    </Button>
  );
}

function FeaturedTourLabel({
  tour,
  completed,
}: {
  tour: FeaturedTour;
  completed: boolean;
}) {
  return (
    <BlockStack className="min-w-0">
      <InlineStack gap="2" blockAlign="center">
        <Paragraph size="sm" weight="semibold" className="truncate">
          {tour.title}
        </Paragraph>
        {tour.tag && (
          <Badge
            size="sm"
            variant={tour.tag === "new" ? "default" : "secondary"}
            className="capitalize"
          >
            {tour.tag}
          </Badge>
        )}
        {completed && (
          <Badge size="sm" variant="outline" className="text-green-600">
            <Icon name="Check" size="xs" aria-hidden="true" />
            Completed
          </Badge>
        )}
        {!tour.available && (
          <Badge size="sm" variant="outline">
            Coming soon
          </Badge>
        )}
      </InlineStack>
      <Text size="xs" tone="subdued">
        {tour.duration}
      </Text>
    </BlockStack>
  );
}
