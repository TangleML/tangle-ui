import { Link } from "@tanstack/react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

interface FeaturedTour {
  id: string;
  title: string;
  duration: string;
  tag?: "new" | "popular";
}

const STUB_TOURS: FeaturedTour[] = [
  {
    id: "first-pipeline",
    title: "Build your first pipeline",
    duration: "4 min",
    tag: "popular",
  },
  { id: "using-secrets", title: "Using secrets safely", duration: "2 min" },
  {
    id: "multinode-tasks",
    title: "Run multinode tasks",
    duration: "3 min",
    tag: "new",
  },
  {
    id: "custom-components",
    title: "Create a custom component",
    duration: "5 min",
  },
];

export function FeaturedTours() {
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
          {STUB_TOURS.map((tour) => (
            <li key={tour.id}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-muted/60 text-left"
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
              </button>
            </li>
          ))}
        </ul>
      </BlockStack>
    </div>
  );
}
