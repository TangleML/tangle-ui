import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { RepositoryLocation } from "@/services/github/repositoryUrl";
import { tracking } from "@/utils/tracking";

import { repositoryWritesAction } from "./useRepositoryWritesToggle";

interface RepositoryWritesButtonProps {
  repository: RepositoryLocation;
  name: string;
  disabled?: boolean;
  onClick: () => void;
}

export function RepositoryWritesButton({
  repository,
  name,
  disabled = false,
  onClick,
}: RepositoryWritesButtonProps) {
  const { icon, label, trackingId } = repositoryWritesAction(repository, name);

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={disabled}
      onClick={onClick}
      className="size-7 text-muted-foreground hover:text-foreground"
      aria-label={label}
      title={label}
      {...tracking(trackingId)}
    >
      <Icon name={icon} size="sm" />
    </Button>
  );
}
