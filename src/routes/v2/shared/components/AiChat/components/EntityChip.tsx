import { observer } from "mobx-react-lite";

import { type IconName } from "@/components/ui/icon";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useFocusActions } from "@/routes/v2/shared/store/useFocusActions";

import { ChatEntityChip } from "./ChatEntityChip";
import { useOptionalChatEntityReveal } from "./ChatEntityRevealContext";
import {
  type ChatEntityKind,
  chatEntityKindFromId,
  resolveChatEntity,
} from "./resolveChatEntity";

const ENTITY_ICON: Record<ChatEntityKind | "unknown", IconName> = {
  task: "SquareFunction",
  input: "ArrowRightToLine",
  output: "ArrowLeftFromLine",
  unknown: "CircleQuestionMark",
};

interface EntityChipProps {
  entityId: string;
  label: string;
}

export const EntityChip = observer(function EntityChip({
  entityId,
  label,
}: EntityChipProps) {
  const reveal = useOptionalChatEntityReveal();
  const { navigation } = useSharedStores();
  const { navigateToEntity } = useFocusActions();

  const resolved = resolveChatEntity(navigation.rootSpec, entityId, label);
  const kind = resolved?.kind ?? chatEntityKindFromId(entityId);

  function handleClick() {
    // In the Tangent workspace, the target tab may be hidden or closed: hand
    // off to the project so it can open/activate the right tab, then focus.
    if (reveal) {
      reveal.revealEntity(entityId, label);
      return;
    }
    // Standalone editor: navigate within the single live spec.
    if (!resolved) return;
    const rootName = navigation.rootSpec?.name;
    navigateToEntity(
      rootName ? [rootName] : [],
      resolved.entityId,
      resolved.kind,
    );
  }

  return (
    <ChatEntityChip
      icon={ENTITY_ICON[kind]}
      label={label}
      onClick={handleClick}
    />
  );
});
