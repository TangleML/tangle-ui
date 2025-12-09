import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Separator } from "@/components/ui/separator";
import type { StoredLibrary } from "@/providers/ComponentLibraryProvider/libraries/storage";

import { AddGitHubLibraryDialogContent } from "./components/AddGitHubLibraryDialogContent";
import { LibraryList } from "./components/LibraryList";
import { UpdateGitHubLibrary } from "./components/UpdateGitHubLibrary";

export function ManageLibrariesDialog({
  defaultMode = "manage",
}: {
  defaultMode?: "add" | "manage" | "update";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "manage" | "update">(defaultMode);
  const [libraryToUpdate, setLibraryToUpdate] = useState<
    StoredLibrary | undefined
  >();

  const handleDialogOpenChange = (open: boolean) => {
    setOpen(open);
    if (!open) {
      setMode("manage");
    }
  };

  const handleUpdateLibrary = (library: StoredLibrary) => {
    setLibraryToUpdate(library);
    setMode("update");
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm">
      <Icon name="Settings" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>{defaultTrigger}</DialogTrigger>
      {open && (
        <DialogContent data-testid="manage-libraries-dialog">
          {mode === "add" && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <InlineStack align="start" gap="1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMode("manage")}
                    >
                      <Icon name="ArrowLeft" />
                    </Button>
                    Add Library
                  </InlineStack>
                </DialogTitle>
              </DialogHeader>

              <AddGitHubLibraryDialogContent
                onOkClick={() => setMode("manage")}
              />
            </>
          )}

          {mode === "manage" && (
            <>
              <DialogHeader>
                <DialogTitle>Manage Libraries</DialogTitle>
              </DialogHeader>
              <DialogDescription>
                Manage your connected libraries.
              </DialogDescription>
              <BlockStack gap="4">
                <LibraryList onUpdateLibrary={handleUpdateLibrary} />
                <Separator />
                <BlockStack gap="1" align="end">
                  <Button variant="secondary" onClick={() => setMode("add")}>
                    <InlineStack align="center" gap="1">
                      <Icon name="Github" />
                      Link Library from GitHub
                    </InlineStack>
                  </Button>
                </BlockStack>
              </BlockStack>
            </>
          )}

          {mode === "update" && libraryToUpdate && (
            <>
              <DialogHeader>
                <DialogTitle>
                  <InlineStack align="start" gap="1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMode("manage")}
                    >
                      <Icon name="ArrowLeft" />
                    </Button>
                    Update Library {libraryToUpdate.name}
                  </InlineStack>
                </DialogTitle>
              </DialogHeader>
              <DialogDescription>
                Update linked GitHub library.
              </DialogDescription>
              <BlockStack gap="4">
                <UpdateGitHubLibrary
                  library={libraryToUpdate}
                  onSuccess={() => setMode("manage")}
                />
              </BlockStack>
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
