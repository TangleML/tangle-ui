import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

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
import { Heading, Paragraph, Text } from "@/components/ui/typography";
import { useTourCompletion } from "@/providers/TourProvider/tourCompletion";
import { resetAllTourPipelineState } from "@/providers/TourProvider/tourPipelineStorage/resetAllTourPipelineState";
import { APP_ROUTES } from "@/routes/router";
import { tracking } from "@/utils/tracking";

import { TourCompletedBadge } from "./TourCompletedBadge";
import {
  type Tour,
  TOUR_DIFFICULTY_BLURBS,
  TOUR_DIFFICULTY_COLORS,
  TOUR_DIFFICULTY_ICONS,
  TOUR_DIFFICULTY_ORDER,
  type TourDifficulty,
  tours,
} from "./tours";

function TourCard({ tour }: { tour: Tour }) {
  const completed = useTourCompletion(tour.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const startTour = () => {
    resetAllTourPipelineState(queryClient);
    void navigate({
      to: APP_ROUTES.TOUR_DETAIL,
      params: { tourId: tour.id },
    });
  };

  return (
    <Card className="h-full py-4 gap-2">
      <CardHeader className="px-4 gap-2">
        <CardTitle className="text-sm leading-snug">{tour.title}</CardTitle>
        <CardDescription className="text-sm">
          {tour.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 mt-auto">
        <InlineStack gap="3" blockAlign="center" align="space-between">
          <InlineStack gap="2" blockAlign="center">
            <Badge size="sm" variant="secondary">
              {tour.area}
            </Badge>
            {completed && <TourCompletedBadge />}
            <Text size="xs" tone="subdued">
              {tour.duration}
            </Text>
          </InlineStack>
          <Button
            size="sm"
            variant="ghost"
            onClick={startTour}
            {...tracking("learning_hub.tours.start", {
              tour_id: tour.id,
              is_restart: completed,
            })}
          >
            {completed ? "Restart" : "Start tour"}
            <Icon
              name={completed ? "RotateCcw" : "Play"}
              size="sm"
              aria-hidden="true"
            />
          </Button>
        </InlineStack>
      </CardContent>
    </Card>
  );
}

function DifficultySection({
  difficulty,
  tours: difficultyTours,
}: {
  difficulty: TourDifficulty;
  tours: Tour[];
}) {
  return (
    <BlockStack gap="3">
      <BlockStack gap="1">
        <InlineStack gap="2" blockAlign="center">
          <Icon
            name={TOUR_DIFFICULTY_ICONS[difficulty]}
            size="md"
            className={TOUR_DIFFICULTY_COLORS[difficulty]}
            aria-hidden="true"
          />
          <Heading level={3}>{difficulty}</Heading>
          <Text size="xs" tone="subdued">
            {difficultyTours.length}{" "}
            {difficultyTours.length === 1 ? "tour" : "tours"}
          </Text>
        </InlineStack>
        <Paragraph size="sm" tone="subdued">
          {TOUR_DIFFICULTY_BLURBS[difficulty]}
        </Paragraph>
      </BlockStack>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {difficultyTours.map((tour) => (
          <TourCard key={tour.id} tour={tour} />
        ))}
      </div>
    </BlockStack>
  );
}

export function ToursLibrary() {
  const buckets = new Map<TourDifficulty, Tour[]>();
  for (const tour of tours) {
    const list = buckets.get(tour.difficulty) ?? [];
    list.push(tour);
    buckets.set(tour.difficulty, list);
  }

  return (
    <BlockStack gap="8">
      {TOUR_DIFFICULTY_ORDER.filter(
        (difficulty) => (buckets.get(difficulty)?.length ?? 0) > 0,
      ).map((difficulty) => (
        <DifficultySection
          key={difficulty}
          difficulty={difficulty}
          tours={buckets.get(difficulty) ?? []}
        />
      ))}
    </BlockStack>
  );
}
