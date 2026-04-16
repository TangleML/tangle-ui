import TooltipButton from "@/components/shared/Buttons/TooltipButton";
import { Icon } from "@/components/ui/icon";
import type { NodeEntityType } from "@/routes/v2/shared/store/editorStore";
import { useFocusActions } from "@/routes/v2/shared/store/useFocusActions";

export function NavigateToEntityButton({
  entityId,
  entityType = "task",
}: {
  entityId: string;
  entityType: NodeEntityType;
}) {
  const { navigateToEntity } = useFocusActions();

  const handleClick = () => {
    navigateToEntity([], entityId, entityType);
  };

  return (
    <TooltipButton
      variant="ghost"
      size="xs"
      onClick={handleClick}
      tooltip="Navigate to task"
    >
      <Icon name="Eye" size="xs" className="text-muted-foreground" />
    </TooltipButton>
  );
}
