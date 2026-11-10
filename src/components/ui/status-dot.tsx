import { cn } from "@/lib/utils";

const TONE = {
  subdued: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
} as const;

export type StatusDotTone = keyof typeof TONE;

/** A small dot saying how something is doing. Say the same in words for screen readers. */
export function StatusDot({
  tone = "subdued",
  pulse = false,
  size = "md",
}: {
  tone?: StatusDotTone;
  pulse?: boolean;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 rounded-full",
        size === "sm" ? "size-1.5" : "size-2",
        TONE[tone],
        pulse && "animate-pulse motion-reduce:animate-none",
      )}
    />
  );
}
