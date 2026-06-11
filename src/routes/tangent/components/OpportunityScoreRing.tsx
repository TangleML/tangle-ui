import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import {
  getScoreColorClass,
  getScoreStrokeClass,
} from "@/routes/tangent/labels";

interface OpportunityScoreRingProps {
  score: number | null;
  /** Pixel diameter of the ring. */
  size?: number;
  /** Show the "Opportunity" label beneath the ring. */
  showLabel?: boolean;
}

const STROKE_WIDTH = 6;

export function OpportunityScoreRing({
  score,
  size = 64,
  showLabel = false,
}: OpportunityScoreRingProps) {
  const radius = (size - STROKE_WIDTH) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const dashOffset = circumference * (1 - progress);

  const tooltip =
    score === null
      ? "Not yet analyzed — click Re-analyze"
      : "Tangent Opportunity Score";

  return (
    <div className="flex flex-col items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="relative flex items-center justify-center"
            style={{ width: size, height: size }}
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="-rotate-90"
              aria-hidden
            >
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={STROKE_WIDTH}
                className="stroke-muted"
              />
              {score !== null && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  className={getScoreStrokeClass(score)}
                  strokeDasharray={circumference}
                  style={{ strokeDashoffset: dashOffset }}
                />
              )}
            </svg>
            <Text
              size="md"
              weight="bold"
              className={cn("absolute", getScoreColorClass(score))}
            >
              {score === null ? "—" : score}
            </Text>
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
      {showLabel && (
        <Text size="xs" tone="subdued">
          Opportunity
        </Text>
      )}
    </div>
  );
}
