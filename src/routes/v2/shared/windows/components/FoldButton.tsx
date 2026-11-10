import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useWindowContext } from "@/routes/v2/shared/windows/ContentWindowStateContext";
import { tracking } from "@/utils/tracking";

/** Folds the window to its header, or opens it back up. */
export const FoldButton = observer(function FoldButton({
  trackingId,
}: {
  trackingId: string;
}) {
  const { model } = useWindowContext();
  const folded = model.isMinimized;

  return (
    <Button
      variant="subtle"
      size="icon-xs"
      aria-label={`${folded ? "Unfold" : "Fold"} ${model.title}`}
      aria-expanded={!folded}
      onClick={(event) => {
        event.stopPropagation();
        model.toggleMinimize();
      }}
      {...tracking(trackingId)}
    >
      <Icon name={folded ? "ChevronRight" : "ChevronDown"} size="xs" />
    </Button>
  );
});
