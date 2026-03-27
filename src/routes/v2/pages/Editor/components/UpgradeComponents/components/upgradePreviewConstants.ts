import type { IconName } from "@/components/ui/icon";
import type { DiffStatus } from "@/routes/v2/pages/Editor/store/actions/task.utils";

export const DIFF_STATUS_CLASSES: Record<DiffStatus, string> = {
  unchanged: "bg-gray-200 text-gray-800",
  lost: "bg-red-100 text-red-700 line-through",
  new: "bg-green-100 text-green-700",
  changed: "bg-amber-100 text-amber-700",
};

export const HANDLE_STATUS_CLASSES: Record<DiffStatus, string> = {
  unchanged: "!bg-gray-500",
  lost: "!bg-red-400",
  new: "!bg-green-500",
  changed: "!bg-amber-500",
};

export const STATUS_ICON: Partial<
  Record<DiffStatus, { name: IconName; className: string }>
> = {
  lost: { name: "Minus", className: "text-red-500" },
  new: { name: "Plus", className: "text-green-600" },
  changed: { name: "RefreshCw", className: "text-amber-600" },
};
