import type { IconName } from "@/components/ui/icon";

export const CONDITION_ICON_NAME: IconName = "Split";

/**
 * Violet is the fixed identity of conditional execution, deliberately outside the
 * per-task colour palette: the run-condition row sits next to the palette-tinted
 * inputs section, and tinting it too would make the two indistinguishable.
 */
export const CONDITION_SURFACE_CLASSES =
  "border border-violet-200 bg-violet-50/80 dark:border-violet-500/40 dark:bg-violet-500/15";

export const CONDITION_CHIP_CLASSES =
  "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200";

export const CONDITION_LABEL_CLASSES = "text-violet-800 dark:text-violet-200";

export const CONDITION_ICON_CLASSES = "text-violet-600 dark:text-violet-300";

export const CONDITION_HANDLE_CLASSES = "bg-violet-500! border-0!";
