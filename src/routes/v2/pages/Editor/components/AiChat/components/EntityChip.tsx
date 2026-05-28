import { observer } from "mobx-react-lite";

import { type IconName } from "@/components/ui/icon";
import type { NodeEntityType } from "@/routes/v2/shared/store/editorStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useFocusActions } from "@/routes/v2/shared/store/useFocusActions";

import { ChatEntityChip } from "./ChatEntityChip";

type EntityKind = "task" | "input" | "output" | "unknown";

const ENTITY_ICON: Record<EntityKind, IconName> = {
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
  const { navigation } = useSharedStores();
  const { navigateToEntity } = useFocusActions();
  const rootSpec = navigation.rootSpec;

  const kind = resolveEntityKind(rootSpec, entityId);

  function handleClick() {
    if (!rootSpec || kind === "unknown") return;
    const nodeType: NodeEntityType = kind;
    navigateToEntity([], entityId, nodeType);
  }

  return (
    <ChatEntityChip
      icon={ENTITY_ICON[kind]}
      label={label}
      onClick={handleClick}
    />
  );
});

function resolveEntityKind(
  rootSpec: {
    tasks: { $id: string }[];
    inputs: { $id: string }[];
    outputs: { $id: string }[];
  } | null,
  entityId: string,
): EntityKind {
  if (!rootSpec) return "unknown";
  if (rootSpec.tasks.some((t) => t.$id === entityId)) return "task";
  if (rootSpec.inputs.some((i) => i.$id === entityId)) return "input";
  if (rootSpec.outputs.some((o) => o.$id === entityId)) return "output";
  return "unknown";
}
