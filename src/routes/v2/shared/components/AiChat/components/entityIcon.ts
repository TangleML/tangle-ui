import { type IconName } from "@/components/ui/icon";

import { type ChatEntityKind } from "./resolveChatEntity";

const ENTITY_ICON: Record<ChatEntityKind, IconName> = {
  task: "SquareFunction",
  input: "ArrowRightToLine",
  output: "ArrowLeftFromLine",
};

const UNKNOWN_ENTITY_ICON: IconName = "CircleQuestionMark";

export function entityIcon(kind: ChatEntityKind | "unknown"): IconName {
  return kind === "unknown" ? UNKNOWN_ENTITY_ICON : ENTITY_ICON[kind];
}
