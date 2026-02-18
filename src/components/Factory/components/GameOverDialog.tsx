import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Text } from "@/components/ui/typography";

import { RESOURCES } from "../data/resources";
import { useStatistics } from "../providers/StatisticsProvider";

interface GameOverDialogProps {
  open: boolean;
  day: number;
  onContinue: () => void;
  onRestart: () => void;
}

export const GameOverDialog = ({
  open,
  day,
  onContinue,
  onRestart,
}: GameOverDialogProps) => {
  const { getLatestDayStats } = useStatistics();
  const latestStats = getLatestDayStats();

  const foodRequired = latestStats?.global.foodRequired || 0;
  const foodDeficit = latestStats?.global.foodDeficit || 0;
  const foodAvailable = foodRequired - foodDeficit;

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">🍂 Game Over</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <BlockStack gap="3">
              <Text>
                Your civilization has run out of food and cannot survive.
              </Text>
              <InlineStack wrap="nowrap" gap="4" align="center">
                <p className="text-[48px] opacity-50">{RESOURCES.food.icon}</p>
                <BlockStack>
                  <Text size="lg">Day {day}</Text>
                  <InlineStack gap="1">
                    <Text>Food Required:</Text>
                    <Text tone="warning">{foodRequired}</Text>
                  </InlineStack>
                  <InlineStack gap="1">
                    <Text>You had:</Text>
                    <Text tone="critical">{foodAvailable}</Text>
                  </InlineStack>
                </BlockStack>
              </InlineStack>
              <Text size="sm" tone="subdued">
                You can continue playing to build up food production, or start
                over with a new civilization.
              </Text>
            </BlockStack>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onContinue}>
            Continue Playing
          </AlertDialogCancel>
          <AlertDialogAction onClick={onRestart}>Start Over</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
