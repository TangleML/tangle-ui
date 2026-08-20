import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { TabsTrigger } from "@/components/ui/tabs";

interface CloseableTabTriggerProps {
  value: string;
  title: string;
  onClose: () => void;
  icon?: IconName;
}

export function CloseableTabTrigger({
  value,
  title,
  onClose,
  icon = "Bot",
}: CloseableTabTriggerProps) {
  return (
    <div className="relative inline-flex items-center">
      <TabsTrigger value={value} className="max-w-44 pr-7">
        <Icon name={icon} size="xs" />
        <span className="min-w-0 truncate">{title}</span>
      </TabsTrigger>
      <Button
        type="button"
        variant="ghost"
        size="min"
        aria-label={`Close ${title}`}
        title={`Close ${title}`}
        className="absolute right-1.5"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        <Icon name="X" size="xs" />
      </Button>
    </div>
  );
}
