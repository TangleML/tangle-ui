import type { IconName } from "@/components/ui/icon";

const ENTITY_ICONS: Record<string, IconName> = {
  pipeline: "GitBranch",
  agent_session: "Bot",
  document: "FileText",
};

// The backend stores `entity` as a plain string and expects more members, so an
// unrecognised one still needs something to render as.
const UNKNOWN_ENTITY_ICON: IconName = "Box";

export const entityIcon = (entity: string): IconName =>
  ENTITY_ICONS[entity] ?? UNKNOWN_ENTITY_ICON;
