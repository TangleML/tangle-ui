import { observer } from "mobx-react-lite";
import { type ChangeEvent, type SubmitEvent, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { BlockStack } from "@/components/ui/layout";
import useToastNotification from "@/hooks/useToastNotification";
import { usePipelineActions } from "@/routes/v2/pages/Editor/store/actions/usePipelineActions";
import { useSharedStores } from "@/routes/v2/shared/store/SharedStoreContext";

export const RenameSubgraphMenuItem = observer(
  function RenameSubgraphMenuItem() {
    const { navigation } = useSharedStores();
    const { renameSubgraph } = usePipelineActions();
    const notify = useToastNotification();

    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);

    const depth = navigation.navigationDepth;
    const currentName =
      depth > 0 ? navigation.navigationPath[depth].displayName : "";

    if (depth === 0) return null;

    const parentSpec = navigation.parentSpec;
    const siblingNames = new Set(
      parentSpec?.tasks.map((t) => t.name).filter((n) => n !== currentName) ??
        [],
    );

    const handleOpenChange = (next: boolean) => {
      if (next) {
        setName(currentName);
        setError(null);
      }
      setOpen(next);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setName(next);

      const trimmed = next.trim();
      if (!trimmed) {
        setError("Name cannot be empty");
      } else if (siblingNames.has(trimmed)) {
        setError("A sibling task already uses this name");
      } else {
        setError(null);
      }
    };

    const handleSubmit = (event: SubmitEvent) => {
      event.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || error) return;

      if (siblingNames.has(trimmed)) {
        setError("A sibling task already uses this name");
        return;
      }

      const ok = renameSubgraph(trimmed);
      if (!ok) {
        notify("Could not rename subgraph", "error");
        return;
      }
      setOpen(false);
    };

    const isDisabled = !!error || !name.trim() || name.trim() === currentName;

    return (
      <>
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            handleOpenChange(true);
          }}
        >
          <Icon name="Pencil" size="sm" />
          Rename Subgraph
        </DropdownMenuItem>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rename Subgraph</DialogTitle>
              <DialogDescription>
                Renames this subgraph within its parent. References from sibling
                tasks are preserved.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <BlockStack gap="2">
                <Input
                  value={name}
                  onChange={handleChange}
                  autoFocus
                  data-testid="rename-subgraph-input"
                />
                {error && (
                  <Alert variant="destructive">
                    <Icon name="CircleAlert" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </BlockStack>
              <DialogFooter className="sm:justify-end mt-4">
                <DialogClose asChild>
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  size="sm"
                  className="px-3"
                  disabled={isDisabled}
                >
                  Rename
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);
