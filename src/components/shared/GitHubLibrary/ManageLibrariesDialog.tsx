import { useCallback, useState } from "react";

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
import { Text } from "@/components/ui/typography";

import { AddGitHubLibraryDialogContent } from "./components/AddGitHubLibraryDialogContent";

export function ManageLibrariesDialog({
  defaultMode = "manage",
}: {
  defaultMode?: "add" | "manage" | "update";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"add" | "manage" | "update">(defaultMode);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setOpen(open);
    if (!open) {
      setMode("manage");
    }
  }, []);

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
                  <InlineStack align="start" blockAlign="center" gap="1">
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
                <BlockStack gap="4" className="min-h-[200px]">
                  {/* TODO: add library list */}
                  <Text>No libraries connected</Text>
                </BlockStack>
                <Separator />
                <BlockStack gap="1" align="end">
                  <Button variant="secondary" onClick={() => setMode("add")}>
                    <InlineStack align="center" blockAlign="center" gap="1">
                      <Icon name="Github" />
                      Link Library from GitHub
                    </InlineStack>
                  </Button>
                </BlockStack>
              </BlockStack>
            </>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
