import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface FileDropHighlightProps {
  isDragging: boolean;
  message: string;
  className?: string;
}

export function FileDropHighlight({
  isDragging,
  message,
  className,
}: FileDropHighlightProps) {
  if (!isDragging) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-primary bg-primary/5",
        className,
      )}
    >
      <Text size="sm" tone="subdued">
        {message}
      </Text>
    </div>
  );
}
