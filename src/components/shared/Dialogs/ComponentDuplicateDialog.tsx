import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockStack } from "@/components/ui/layout";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import {
  deleteComponentFileFromList,
  generateDigest,
} from "@/utils/componentStore";
import { USER_COMPONENTS_LIST_NAME } from "@/utils/constants";
import type { UserComponent } from "@/utils/localforage";

import { InfoBox } from "../InfoBox";

const ComponentDuplicateDialog = ({
  existingComponent,
  newComponent,
  setClose,
  handleImportComponent,
}: {
  existingComponent?: UserComponent;
  newComponent?: HydratedComponentReference | null;
  setClose: () => void;
  handleImportComponent: (content: string) => Promise<void>;
}) => {
  const [newName, setNewName] = useState("");
  const [newDigest, setNewDigest] = useState("");

  const open = !!existingComponent && !!newComponent && !!newName;
  const disableImportAsNew =
    !newName || newName.trim() === existingComponent?.name?.trim();

  const handleOnOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setClose();
      }
    },
    [setClose],
  );

  useEffect(() => {
    if (newComponent && open) {
      generateNewDigest(newComponent, newName).then(setNewDigest);
    }
  }, [newComponent, open, newName]);

  const handleRenameAndImport = useCallback(
    async (newName: string) => {
      if (!newComponent) {
        return;
      }

      const { text } = await replaceComponentName(newComponent, newName);

      await handleImportComponent(text);

      setClose();
    },
    [handleImportComponent, setClose],
  );

  const handleReplaceAndImport = useCallback(async () => {
    if (!newComponent) {
      return;
    }

    const yamlString = newComponent.text;

    await deleteComponentFileFromList(
      USER_COMPONENTS_LIST_NAME,
      existingComponent?.name ?? "",
    );
    handleImportComponent(yamlString);

    setClose();
  }, [handleImportComponent, setClose]);

  const handleCancel = useCallback(() => {
    setClose();
  }, [setClose]);

  useEffect(() => {
    if (newComponent && newComponent?.name) {
      setNewName(newComponent?.name);
    }
  }, [existingComponent, newComponent]);

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle data-testid="component-duplicate-dialog-title">
            Component already exists
          </DialogTitle>
          <DialogDescription>
            The component you are trying to import already exists. Please enter
            a new name for the component or replace the existing component.
          </DialogDescription>
          <DialogDescription>
            Note: &quot;Replace existing&quot; will use the existing name.
          </DialogDescription>
        </DialogHeader>
        <InfoBox title="Existing Component" className="p-2">
          <BlockStack gap="2" className="w-full">
            <Label className="text-xs font-medium">Name</Label>
            <Input
              value={existingComponent?.name ?? ""}
              readOnly
              className="text-xs border-blue-200 bg-blue-100/50"
            />
            <Label className="text-xs font-medium">Digest</Label>
            <Input
              value={existingComponent?.componentRef.digest ?? ""}
              readOnly
              className="text-xs border-blue-200 bg-blue-100/50"
            />
          </BlockStack>
        </InfoBox>
        <InfoBox title="New Component" variant="ghost" className="p-2">
          <BlockStack gap="2" className="w-full">
            <Label className="text-xs font-medium">Name</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus={true}
            />
            <Label className="text-xs font-medium">Digest</Label>
            <Input value={newDigest} readOnly className="text-xs" />
          </BlockStack>
        </InfoBox>

        <DialogFooter>
          <Button
            onClick={() => handleRenameAndImport(newName ?? "")}
            disabled={disableImportAsNew}
          >
            Import as new
          </Button>
          <Button
            onClick={handleReplaceAndImport}
            data-testid="duplicate-component-replace-existing-button"
          >
            Replace existing
          </Button>
          <Button
            onClick={handleCancel}
            data-testid="duplicate-component-cancel-button"
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ComponentDuplicateDialog;

async function generateNewDigest(
  newComponent: HydratedComponentReference | null | undefined,
  newName: string,
) {
  if (newComponent) {
    const { digest } = await replaceComponentName(newComponent, newName);
    return digest;
  }

  return "";
}

async function replaceComponentName(
  component: HydratedComponentReference,
  newName: string,
) {
  const escapeRegex = (str: string) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // assuming component has TEXT
  const text =
    newName && newName.trim().length > 0 && newName !== component.name
      ? component.text.replace(
          // todo: use a more robust regex to replace the name
          new RegExp(`^name: ${escapeRegex(component.name)}(\\s*)$`, "gm"),
          `name: ${newName}$1`,
        )
      : component.text;

  return {
    text,
    digest: await generateDigest(text),
    name: newName,
  };
}
