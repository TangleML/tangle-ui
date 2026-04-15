import { observer } from "mobx-react-lite";

import { Icon, type IconName } from "@/components/ui/icon";
import type { NodeEntityType } from "@/routes/v2/shared/store/editorStore";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";
import { useFocusActions } from "@/routes/v2/shared/store/useFocusActions";

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
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-0.5 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer align-middle"
    >
      <Icon
        name={ENTITY_ICON[kind]}
        className="size-3 shrink-0 text-muted-foreground"
      />
      <span className="truncate max-w-[160px]">{label}</span>
    </button>
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
