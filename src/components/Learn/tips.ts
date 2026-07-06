import type { IconName } from "@/components/ui/icon";

import tipsData from "./tips.json";

export type TipCategory =
  "Shortcuts" | "Editor" | "Library" | "Runs" | "System" | "Advanced";

export interface Tip {
  id: string;
  category: TipCategory;
  title: string;
  body: string;
}

export const tips = tipsData as Tip[];

export const TIP_CATEGORY_ORDER: TipCategory[] = [
  "Shortcuts",
  "Editor",
  "Library",
  "Runs",
  "System",
  "Advanced",
];

export const TIP_CATEGORY_ICONS: Record<TipCategory, IconName> = {
  Shortcuts: "Keyboard",
  Editor: "Workflow",
  Library: "Library",
  Runs: "Play",
  System: "Save",
  Advanced: "PencilRuler",
};
