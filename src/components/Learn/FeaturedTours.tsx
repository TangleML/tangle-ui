import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useTours } from "@/providers/TourProvider";
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
  { id: "navigating-editor", tag: "new" },
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
  const { startTour } = useTours();
  const featured = buildFeaturedTours();

  return (
    <div className="h-full rounded-xl border border-border bg-card p-5">
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

        <ul className="list-none p-0 m-0 flex flex-col gap-1 flex-1">
          {featured.map((tour) => (
            <li key={tour.id}>
              <Button
                type="button"
                variant="ghost"
                disabled={!tour.available}
                onClick={() => {
                  if (tour.available) void startTour(tour.id);
                }}
                className="w-full h-auto justify-between gap-3 px-3 py-2 text-left"
                {...tracking("learning_hub.tours.start", { tour_id: tour.id })}
              >
                <BlockStack gap="0" className="min-w-0">
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
                <Icon
                  name="Play"
                  size="sm"
                  className="text-muted-foreground shrink-0"
                  aria-hidden="true"
                />
              </Button>
            </li>
          ))}
        </ul>
      </BlockStack>
    </div>
  );
}
