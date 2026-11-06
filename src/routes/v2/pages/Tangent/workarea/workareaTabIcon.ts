import type { IconName } from "@/components/ui/icon";

import { getWorkareaKind } from "./registry";
import type { WorkareaTab } from "./types";

export function workareaTabIcon(tab: WorkareaTab): IconName {
  return getWorkareaKind(tab.target.type)?.icon ?? "FileText";
}
