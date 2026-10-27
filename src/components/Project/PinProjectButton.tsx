import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

import { useProjectPin } from "./useProjectPin";

interface PinProjectButtonProps {
  project: { id: string; name: string };
  className?: string;
}

export function PinProjectButton({
  project,
  className,
}: PinProjectButtonProps) {
  const { pinned, isPinning, togglePin } = useProjectPin(project);
  const label = pinned
    ? `Remove ${project.name} from favorites`
    : `Add ${project.name} to favorites`;

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isPinning}
      onClick={() => void togglePin()}
      aria-label={label}
      aria-pressed={pinned}
      title={label}
      className={cn(
        "shrink-0",
        pinned
          ? "text-warning hover:text-warning"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...tracking("projects.favorite_project", { new_value: !pinned })}
    >
      <Icon name="Star" size="sm" className={cn(pinned && "fill-warning")} />
    </Button>
  );
}
