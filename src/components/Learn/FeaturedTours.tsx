import { Link, useNavigate } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
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

  const startTour = (tourId: string) => {
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
            <Button
              key={tour.id}
              variant="ghost"
              size="lg"
              disabled={!tour.available}
              onClick={() => startTour(tour.id)}
              {...tracking("learning_hub.tours.start", {
                tour_id: tour.id,
              })}
            >
              <InlineStack
                gap="4"
                align="space-between"
                blockAlign="center"
                wrap="nowrap"
              >
                <FeaturedTourLabel tour={tour} />
                <Icon
                  name="Play"
                  size="sm"
                  className="text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
              </InlineStack>
            </Button>
          ))}
        </BlockStack>
      </BlockStack>
    </div>
  );
}

function FeaturedTourLabel({ tour }: { tour: FeaturedTour }) {
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
