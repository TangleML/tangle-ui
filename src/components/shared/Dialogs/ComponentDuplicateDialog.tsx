import { useCallback, useEffect, useMemo, useState } from "react";

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
import { Text } from "@/components/ui/typography";
import { useComponentLibrary } from "@/providers/ComponentLibraryProvider";
import type { HydratedComponentReference } from "@/utils/componentSpec";
import {
  deleteComponentFileFromList,
  generateDigest,
} from "@/utils/componentStore";
import { USER_COMPONENTS_LIST_NAME } from "@/utils/constants";
import type { UserComponent } from "@/utils/localforage";

import { InfoBox } from "../InfoBox";

function useNameValidation() {
  const { userComponentsFolder } = useComponentLibrary();

  const nameIndex = useMemo(() => {
    return new Set(userComponentsFolder?.components?.map((c) => c.name) ?? []);
  }, [userComponentsFolder]);

  return useCallback(
    (existingComponent: UserComponent | undefined, newName: string) => {
      if (existingComponent?.name === newName) {
        return [];
      }

      if (!newName || newName.trim() === "") {
        return ["Name cannot be empty"];
      }

      // check name uniqueness
      const hasDuplicate = nameIndex.has(newName);

      if (hasDuplicate) {
        return ["Name already exists"];
      }

      return [];
    },
    [nameIndex],
  );
}

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
  const validateName = useNameValidation();
  const [newName, setNewName] = useState("");
  const [newDigest, setNewDigest] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const open = !!existingComponent && !!newComponent;
  const disableImportAsNew =
    !newName || newName.trim() === existingComponent?.name?.trim();

  const handleOnOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        setClose();
      }
    },
    [setClose, setErrors],
  );

  useEffect(() => {
    if (newComponent && open) {
      generateNewDigest(newComponent, newName).then(setNewDigest);
    }

    if (!open) {
      setErrors([]);
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
    await handleImportComponent(yamlString);

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

  const updateName = useCallback(
    (newName: string) => {
      setNewName(newName);
      setErrors(validateName(existingComponent, newName));
    },
    [validateName, existingComponent],
  );

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
              onChange={(e) => updateName(e.target.value ?? "")}
              autoFocus={true}
            />
            {errors.length > 0 &&
              errors.map((error) => (
                <Text size="xs" tone="critical" key={error}>
                  {error}
                </Text>
              ))}
            <Label className="text-xs font-medium">Digest</Label>
            <Input value={newDigest} readOnly className="text-xs" />
          </BlockStack>
        </InfoBox>

        <DialogFooter>
          <Button
            onClick={() => handleRenameAndImport(newName ?? "")}
            disabled={disableImportAsNew || errors.length > 0}
          >
            Import as new
          </Button>
          <Button
            onClick={handleReplaceAndImport}
            data-testid="duplicate-component-replace-existing-button"
            disabled={errors.length > 0}
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
