import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Progress } from "@/components/ui/progress";
import { SidebarGroup } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { useStatistics } from "../providers/StatisticsProvider";
import { type GameSpeed, useTime } from "../providers/TimeProvider";

const MAX_PROGRESS = 1000;

export const Time = () => {
  const { currentDay } = useStatistics();
  const { progress, isPaused, gameSpeed, togglePause, setGameSpeed, skipDay } =
    useTime();

  const progressPercent = (progress / MAX_PROGRESS) * 100;

  return (
    <SidebarGroup>
      <BlockStack gap="2">
        <div
          className="w-full hover:bg-accent rounded-lg p-2 cursor-pointer"
          onClick={skipDay}
        >
          <Text weight="semibold" size="sm">
            Day {currentDay}
          </Text>
          <Progress value={progressPercent} className="h-2" />
        </div>

        <InlineStack gap="2" blockAlign="center" className="w-full px-2">
          <TooltipButton
            value="pause"
            className={cn(
              "h-8 w-8",
              isPaused
                ? "hover:bg-accent hover:text-foreground hover:border hover:border-foreground cursor-pointer"
                : "bg-accent hover:text-background border-foreground border text-foreground",
            )}
            onClick={togglePause}
            tooltip={isPaused ? "Play (Space)" : "Pause (Space)"}
          >
            <Icon name="Pause" size="sm" />
          </TooltipButton>

          <ToggleGroup
            type="single"
            value={gameSpeed}
            onValueChange={(value) => {
              if (value) setGameSpeed(value as GameSpeed);
            }}
          >
            <ToggleGroupItem
              value="slow"
              className={cn(
                "h-8 w-8",
                isPaused && gameSpeed === "slow" && "border border-foreground",
                !isPaused &&
                  gameSpeed === "slow" &&
                  "bg-foreground! text-background!",
              )}
            >
              <Icon name="Play" size="sm" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="medium"
              className={cn(
                "h-8 w-8",
                isPaused &&
                  gameSpeed === "medium" &&
                  "border border-foreground",
                !isPaused &&
                  gameSpeed === "medium" &&
                  "bg-foreground! text-background!",
              )}
            >
              <Icon name="FastForward" size="sm" />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="fast"
              className={cn(
                "h-8 w-8",
                isPaused && gameSpeed === "fast" && "border border-foreground",
                !isPaused &&
                  gameSpeed === "fast" &&
                  "bg-foreground! text-background!",
              )}
            >
              <Icon name="SkipForward" size="sm" />
            </ToggleGroupItem>
          </ToggleGroup>
        </InlineStack>
      </BlockStack>
    </SidebarGroup>
  );
};
