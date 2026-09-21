import { observer } from "mobx-react-lite";

import { type IconName } from "@/components/ui/icon";
import type { ComponentSpec } from "@/models/componentSpec";
import { locateFlexNode } from "@/models/componentSpec/queries/flexNodes";
import type { LocatedEntityKind } from "@/models/componentSpec/queries/locateEntity";
import { locateEntity } from "@/models/componentSpec/queries/locateEntity";
import { useAiChatMode } from "@/routes/v2/shared/components/AiChat/AiChatStoreContext";
import type { NavigationStore } from "@/routes/v2/shared/store/navigationStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useFocusActions } from "@/routes/v2/shared/store/useFocusActions";

import { ChatEntityChip } from "./ChatEntityChip";

type ChipEntityKind = Exclude<LocatedEntityKind, "binding"> | "flex";

const ENTITY_ICON: Record<ChipEntityKind, IconName> = {
  task: "SquareFunction",
  input: "ArrowRightToLine",
  output: "ArrowLeftFromLine",
  flex: "StickyNote",
};

const UNKNOWN_ICON: IconName = "CircleQuestionMark";

interface EntityChipProps {
  entityId: string;
  label: string;
}

interface NavigableEntity {
  type: ChipEntityKind;
  navigationPath: string[];
}

export const EntityChip = observer(function EntityChip({
  entityId,
  label,
}: EntityChipProps) {
  const { navigation } = useSharedStores();
  const { navigateToEntity } = useFocusActions();
  const mode = useAiChatMode();

  const located = resolveNavigableEntity(navigation.rootSpec, entityId);
  const target =
    located && canNavigateTo(mode, navigation, located.navigationPath)
      ? located
      : undefined;

  function handleClick() {
    if (!target) return;
    navigateToEntity(target.navigationPath, entityId, target.type);
  }

  return (
    <ChatEntityChip
      icon={located ? ENTITY_ICON[located.type] : UNKNOWN_ICON}
      label={label}
      disabled={!target}
      onClick={handleClick}
    />
  );
});

/**
 * Entities inside a subgraph need the navigation path to their owning spec, not
 * just their `$id` — `navigateToPath` expects the root pipeline name followed by
 * the chain of subgraph task names. Bindings have no node to focus, so they are
 * not navigable.
 *
 * Sticky notes are annotation data rather than entities, so `locateEntity`
 * cannot see them and they need the separate descent.
 */
function resolveNavigableEntity(
  rootSpec: ComponentSpec | null,
  entityId: string,
): NavigableEntity | undefined {
  if (!rootSpec) return undefined;

  const location = locateEntity(rootSpec, entityId);
  if (location) {
    if (location.kind === "binding") return undefined;
    return {
      type: location.kind,
      navigationPath: [rootSpec.name, ...location.subgraphTaskNames],
    };
  }

  const note = locateFlexNode(rootSpec, entityId);
  if (!note) return undefined;

  return {
    type: "flex",
    navigationPath: [rootSpec.name, ...note.subgraphTaskNames],
  };
}

/**
 * In RunView the canvas spec and the execution scope are kept in step by
 * `useRunViewSubgraphUrlSync`, which can only resolve a child execution id when
 * the path deepens one level from wherever it already is. A chip jumping two
 * levels down, or sideways into a sibling subgraph, would move the canvas while
 * `ExecutionDataProvider` stayed scoped to the old subgraph, leaving task
 * statuses and artifacts wrong or missing. Until that hook can rebuild the whole
 * segment chain, RunView chips only navigate within the graph already on screen.
 */
function canNavigateTo(
  mode: "editor" | "runView",
  navigation: NavigationStore,
  targetPath: string[],
): boolean {
  if (mode === "editor") return true;

  const currentPath = navigation.navigationPath.map((e) => e.displayName);
  return (
    currentPath.length === targetPath.length &&
    currentPath.every((name, index) => name === targetPath[index])
  );
}
