import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { BlockStack } from "@/components/ui/layout";
import { useDialog } from "@/providers/DialogProvider/hooks/useDialog";
import { convertCancelErrorTo } from "@/providers/DialogProvider/utils";
import { EditMemoryDialog } from "@/routes/v2/pages/Tangent/components/EditMemoryDialog";
import { useTangentProject } from "@/routes/v2/pages/Tangent/context/TangentProjectContext";

export function MemoryWindowContent() {
  const { memory, setMemory } = useTangentProject();
  const { open } = useDialog();

  async function handleEditMemory() {
    const result = await open<string, { currentMemory: string }>({
      component: EditMemoryDialog,
      props: { currentMemory: memory },
      routeKey: "edit-memory",
    }).catch(convertCancelErrorTo(undefined));

    if (result === undefined) return;
    await setMemory(result);
  }

  return (
    <BlockStack gap="2" className="p-2">
      <Button variant="outline" size="sm" onClick={handleEditMemory}>
        <Icon name="Pencil" size="xs" />
        Edit memory
      </Button>
    </BlockStack>
  );
}
