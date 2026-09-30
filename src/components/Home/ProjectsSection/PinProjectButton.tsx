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
  const { pinned, togglePin } = useProjectPin(project);
  const label = pinned ? `Unpin ${project.name}` : `Pin ${project.name}`;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={togglePin}
      aria-label={label}
      aria-pressed={pinned}
      title={label}
      className={cn(
        "shrink-0",
        pinned
          ? "text-brand-accent hover:text-brand-accent"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...tracking("projects.pin_project", { new_value: !pinned })}
    >
      <Icon name={pinned ? "PinOff" : "Pin"} size="sm" />
    </Button>
  );
}
