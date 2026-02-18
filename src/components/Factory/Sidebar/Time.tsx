import { useEffect, useRef, useState } from "react";

import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Progress } from "@/components/ui/progress";
import { SidebarGroup } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

const TICK_INTERVAL = 40; // ~25fps
const MAX_PROGRESS = 1000;
const BASE_DAY_DURATION = 5000; // ms
const BASE_INCREMENT = MAX_PROGRESS / (BASE_DAY_DURATION / TICK_INTERVAL);
const DAY_TRANSITION_PAUSE = 200; // ms pause between days

const GAME_SPEED_MULTIPLIER = {
  slow: 1,
  medium: 2,
  fast: 5,
};

type GameSpeed = keyof typeof GAME_SPEED_MULTIPLIER;

interface TimeProps {
  day: number;
  onAdvanceDay: () => void;
}

export const Time = ({ day, onAdvanceDay }: TimeProps) => {
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [gameSpeed, setGameSpeed] = useState<GameSpeed>("slow");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleTogglePlay = () => {
    setIsPaused((prev) => !prev);
  };

  const handleDaySkip = () => {
    if (isTransitioning) return;

    setIsTransitioning(true);
    setProgress(0);

    setTimeout(() => {
      onAdvanceDay();
      setIsTransitioning(false);
    }, DAY_TRANSITION_PAUSE);
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        handleTogglePlay();
      }

      if (event.key === "1") {
        setGameSpeed("slow");
      } else if (event.key === "2") {
        setGameSpeed("medium");
      } else if (event.key === "3") {
        setGameSpeed("fast");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isPaused || isTransitioning) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        const speedMultiplier = GAME_SPEED_MULTIPLIER[gameSpeed];
        const increment = BASE_INCREMENT * speedMultiplier;
        const newProgress = prev + increment;

        if (newProgress >= MAX_PROGRESS) {
          setIsTransitioning(true);

          setProgress(0);

          setTimeout(() => {
            onAdvanceDay();
            setIsTransitioning(false);
          }, DAY_TRANSITION_PAUSE);

          return 0;
        }

        return newProgress;
      });
    }, TICK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, gameSpeed, onAdvanceDay, isTransitioning]);

  const progressPercent = (progress / MAX_PROGRESS) * 100;

  return (
    <SidebarGroup>
      <BlockStack gap="2">
        <div
          className="w-full hover:bg-accent rounded-lg p-2 cursor-pointer"
          onClick={handleDaySkip}
        >
          <Text weight="semibold" size="sm">
            Day {day}
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
            onClick={handleTogglePlay}
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
