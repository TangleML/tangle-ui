import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";

import { useCreateFolder } from "../hooks/useFolderMutations";

interface CreateFolderDialogProps {
  parentId: string | null;
}

export function CreateFolderDialog({ parentId }: CreateFolderDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const createFolder = useCreateFolder();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    createFolder.mutate(
      { name: trimmed, parentId },
      {
        onSuccess: () => {
          setName("");
          setOpen(false);
        },
      },
    );
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setName("");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 rounded-lg px-3 py-2 text-sm"
        >
          <Icon name="FolderPlus" size="lg" />
          New Folder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <BlockStack gap="4">
            <BlockStack gap="2">
              <Label htmlFor="create-folder-name">Folder name</Label>
              <Input
                id="create-folder-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My folder"
                autoFocus
              />
            </BlockStack>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={name.trim().length === 0 || createFolder.isPending}
              >
                Create
              </Button>
            </DialogFooter>
          </BlockStack>
        </form>
      </DialogContent>
    </Dialog>
  );
}
