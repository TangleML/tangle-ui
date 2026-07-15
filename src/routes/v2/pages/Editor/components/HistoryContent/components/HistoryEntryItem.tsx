import { cva } from "class-variance-authority";

import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/typography";
import { tracking } from "@/utils/tracking";

const historyButtonVariants = cva(
  "flex items-start gap-1.5 px-2 py-1 rounded w-full text-left transition-colors hover:bg-slate-100 dark:hover:bg-accent focus:outline-none focus:ring-1 focus:ring-blue-400 focus:ring-inset",
  {
    variants: {
      isCurrent: { true: "", false: "" },
      isInFuture: { true: "", false: "" },
    },
    compoundVariants: [
      {
        isCurrent: false,
        isInFuture: false,
        className: "border border-transparent",
      },
      {
        isCurrent: false,
        isInFuture: true,
        className: "opacity-50",
      },
      {
        isCurrent: true,
        className:
          "bg-blue-50 border border-blue-200 hover:bg-blue-100 dark:bg-blue-500/15 dark:border-blue-500/30 dark:hover:bg-blue-500/25",
      },
    ],
    defaultVariants: { isCurrent: false, isInFuture: false },
  },
);

const historyDotVariants = cva("w-1.5 h-1.5 rounded-full shrink-0 mt-1", {
  variants: {
    isCurrent: { true: "", false: "" },
    isInFuture: { true: "", false: "" },
  },
  compoundVariants: [
    {
      isCurrent: false,
      isInFuture: false,
      className: "bg-green-500",
    },
    {
      isCurrent: false,
      isInFuture: true,
      className: "bg-slate-300 dark:bg-slate-600",
    },
    { isCurrent: true, className: "bg-blue-500" },
  ],
  defaultVariants: { isCurrent: false, isInFuture: false },
});

const historyTextVariants = cva("min-w-0 flex-1 break-words", {
  variants: {
    isCurrent: { true: "", false: "" },
    isInFuture: { true: "", false: "" },
  },
  compoundVariants: [
    {
      isCurrent: false,
      isInFuture: false,
      className: "text-slate-700 dark:text-slate-200",
    },
    {
      isCurrent: false,
      isInFuture: true,
      className: "text-slate-400 dark:text-slate-500",
    },
    { isCurrent: true, className: "text-blue-700 dark:text-blue-300" },
  ],
  defaultVariants: { isCurrent: false, isInFuture: false },
});

const historyIconVariants = cva("shrink-0 mt-0.5", {
  variants: {
    isInFuture: {
      true: "text-slate-400 dark:text-slate-500",
      false: "text-green-600 dark:text-green-400",
    },
  },
  defaultVariants: { isInFuture: false },
});

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
      {...(isInFuture
        ? tracking("v2.pipeline_editor.history.entry_future")
        : tracking("v2.pipeline_editor.history.entry_past"))}
      onClick={onClick}
      className={historyButtonVariants({ isCurrent, isInFuture })}
    >
      <div className={historyDotVariants({ isCurrent, isInFuture })} />

      <Text
        size="xs"
        weight={isCurrent ? "semibold" : "regular"}
        className={historyTextVariants({ isCurrent, isInFuture })}
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
          className={historyIconVariants({ isInFuture })}
        />
      )}
    </button>
  );
}
