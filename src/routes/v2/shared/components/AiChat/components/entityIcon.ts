import { type IconName } from "@/components/ui/icon";

import { type ChatEntityKind } from "./resolveChatEntity";

/** A sticky note is chip-able but not mentionable, so it is not a {@link ChatEntityKind}. */
type IconEntityKind = ChatEntityKind | "flex";

const ENTITY_ICON: Record<IconEntityKind, IconName> = {
  task: "SquareFunction",
  input: "ArrowRightToLine",
  output: "ArrowLeftFromLine",
  flex: "StickyNote",
};

const UNKNOWN_ENTITY_ICON: IconName = "CircleQuestionMark";

export function entityIcon(kind: IconEntityKind | "unknown"): IconName {
  return kind === "unknown" ? UNKNOWN_ENTITY_ICON : ENTITY_ICON[kind];
}
