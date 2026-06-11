import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface MetricDeltaProps {
  /** Percentage change vs baseline; positive renders green, negative red. */
  deltaPct: number;
  className?: string;
}

export function MetricDelta({ deltaPct, className }: MetricDeltaProps) {
  const isPositive = deltaPct >= 0;
  const arrow = isPositive ? "▲" : "▼";
  const sign = isPositive ? "+" : "";
  return (
    <Text
      size="sm"
      weight="semibold"
      className={cn(
        isPositive
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-destructive",
        className,
      )}
    >
      {arrow} {sign}
      {deltaPct.toFixed(1)}%
    </Text>
  );
}
