import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { tracking } from "@/utils/tracking";

export function InitialStateMarker({
  isCurrent,
  onClick,
}: {
  isCurrent: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      {...tracking("v2.pipeline_editor.history.initial_state")}
      onClick={onClick}
      disabled={isCurrent}
      className={cn(
        "flex items-start gap-1.5 px-2 py-1 rounded w-full text-left transition-colors",
        "hover:bg-slate-100 dark:hover:bg-accent focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-inset",
        isCurrent &&
          "bg-green-50 border border-green-200 hover:bg-green-50 dark:bg-green-500/15 dark:border-green-500/30 dark:hover:bg-green-500/15",
        !isCurrent && "border border-transparent",
      )}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0 mt-1",
          isCurrent ? "bg-green-500" : "bg-slate-300 dark:bg-slate-600",
        )}
      />
      <Text
        size="xs"
        weight={isCurrent ? "semibold" : "regular"}
        className={cn(
          "min-w-0 flex-1 break-words",
          isCurrent
            ? "text-green-700 dark:text-green-300"
            : "text-slate-500 dark:text-muted-foreground",
        )}
      >
        Initial state
        {isCurrent && (
          <Text as="span" size="xs" className="text-green-500 ml-1">
            ●
          </Text>
        )}
      </Text>
      {!isCurrent && (
        <Icon
          name="RotateCcw"
          size="xs"
          className="shrink-0 mt-0.5 text-slate-400 dark:text-slate-500"
        />
      )}
    </button>
  );
}
