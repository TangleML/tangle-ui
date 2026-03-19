import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

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
      onClick={onClick}
      disabled={isCurrent}
      className={cn(
        "flex items-start gap-1.5 px-2 py-1 rounded w-full text-left transition-colors",
        "hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-inset",
        isCurrent && "bg-green-50 border border-green-200 hover:bg-green-50",
        !isCurrent && "border border-transparent",
      )}
    >
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0 mt-1",
          isCurrent ? "bg-green-500" : "bg-slate-300",
        )}
      />
      <Text
        size="xs"
        weight={isCurrent ? "semibold" : "regular"}
        className={cn(
          "min-w-0 flex-1 break-words",
          isCurrent ? "text-green-700" : "text-slate-500",
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
          className="shrink-0 mt-0.5 text-slate-400"
        />
      )}
    </button>
  );
}
