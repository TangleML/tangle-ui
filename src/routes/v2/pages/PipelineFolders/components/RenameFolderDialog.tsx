import { type FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import { useAnalytics } from "@/providers/AnalyticsProvider";
import { tracking } from "@/utils/tracking";

interface RenameFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onRename: (name: string) => void;
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  currentName,
  onRename,
}: RenameFolderDialogProps) {
  const [name, setName] = useState(currentName);
  const { track } = useAnalytics();

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  useEffect(() => {
    if (open) {
      track("v2.pipeline_folders.rename_folder_dialog_impression");
    }
  }, [open, track]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      onRename(trimmed);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <BlockStack gap="4">
            <BlockStack gap="2">
              <Label htmlFor="rename-folder-name">Folder name</Label>
              <Input
                id="rename-folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </BlockStack>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                {...tracking("v2.pipeline_folders.rename_folder_cancel")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={name.trim().length === 0}
                {...tracking("v2.pipeline_folders.rename_folder_submit")}
              >
                Rename
              </Button>
            </DialogFooter>
          </BlockStack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
