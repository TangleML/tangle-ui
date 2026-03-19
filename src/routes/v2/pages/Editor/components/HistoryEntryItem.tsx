import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface HistoryEntryItemProps {
  actionName: string;
  index: number;
  isCurrent: boolean;
  isInFuture: boolean;
  onClick: () => void;
}

export function HistoryEntryItem({
  actionName,
  isCurrent,
  isInFuture,
  onClick,
}: HistoryEntryItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-1.5 px-2 py-1 rounded w-full text-left transition-colors",
        "hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-inset",
        isCurrent && "bg-blue-50 border border-blue-200 hover:bg-blue-100",
        isInFuture && "opacity-50",
        !isCurrent && !isInFuture && "border border-transparent",
      )}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0 mt-1",
          isCurrent
            ? "bg-blue-500"
            : isInFuture
              ? "bg-slate-300"
              : "bg-green-500",
        )}
      />

      <Text
        size="xs"
        weight={isCurrent ? "semibold" : "regular"}
        className={cn(
          "min-w-0 flex-1 break-words",
          isCurrent
            ? "text-blue-700"
            : isInFuture
              ? "text-slate-400"
              : "text-slate-700",
        )}
      >
        {actionName}
        {isCurrent && (
          <Text as="span" size="xs" className="text-blue-500 ml-1">
            ●
          </Text>
        )}
      </Text>

      {!isCurrent && (
        <Icon
          name={isInFuture ? "Redo2" : "Undo2"}
          size="xs"
          className={cn(
            "shrink-0 mt-0.5",
            isInFuture ? "text-slate-400" : "text-green-600",
          )}
        />
      )}
    </button>
  );
}
