import { useQueryClient } from "@tanstack/react-query";
import { type DragEvent, useState } from "react";

import useImportComponent from "@/hooks/useImportComponent";
import useToastNotification from "@/hooks/useToastNotification";
import {
  type ExistingAndNewComponent,
  getExistingAndNewUserComponent,
} from "@/services/componentService";
import { addComponentToListByTextWithDuplicateCheck } from "@/utils/componentStore";
import { USER_COMPONENTS_LIST_NAME } from "@/utils/constants";

interface useComponentUploaderProps {
  onImportSuccess?: (
    content: string,
    dropEvent?: DragEvent<HTMLDivElement>,
  ) => void;
}

const useComponentUploader = (
  readOnly = false,
  { onImportSuccess }: useComponentUploaderProps,
) => {
  const [existingAndNewComponent, setExistingAndNewComponent] = useState<
    ExistingAndNewComponent | undefined
  >(undefined);
  const notify = useToastNotification();
  const queryClient = useQueryClient();

  const { onImportFromFile } = useImportComponent({
    successCallback: () => {
      notify("Component imported successfully", "success");
    },
    errorCallback: (error: Error) => {
      notify(error.message, "error");
    },
  });

  const handleFileUpload = async (
    file: File,
    dropEvent?: DragEvent<HTMLDivElement>,
  ) => {
    if (!file.name.endsWith(".yaml")) {
      notify("Only YAML files are supported", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result;
      if (!content) {
        notify("Failed to read file", "error");
        return;
      }

      try {
        const { existingComponent, newComponent } =
          await getExistingAndNewUserComponent(content);

        if (!existingComponent && newComponent) {
          await onImportFromFile(content as string);
          onImportSuccess?.(content as string, dropEvent);
        } else if (existingComponent && newComponent) {
          setExistingAndNewComponent({
            existingComponent,
            newComponent,
          });
        } else if (!newComponent) {
          notify(
            "There was an error importing the component. Please try again.",
            "error",
          );
        }
      } catch (error) {
        notify((error as Error).message, "error");
      }
    };

    reader.readAsText(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0], event);
    }
  };

  const handleCancelUpload = () => {
    setExistingAndNewComponent(undefined);
  };

  const handleImportComponent = async (content: string, filename?: string) => {
    await addComponentToListByTextWithDuplicateCheck(
      USER_COMPONENTS_LIST_NAME,
      content,
      filename,
      "Imported Component",
      true,
      { favorited: true },
    );
    onImportSuccess?.(content);
    // Invalidate the userComponents query to refresh the sidebar
    queryClient.invalidateQueries({ queryKey: ["userComponents"] });
    handleCancelUpload();
  };

  if (readOnly) {
    return {
      handleDrop: () => {},
      existingAndNewComponent: undefined,
      handleCancelUpload,
      handleImportComponent,
    };
  }

  return {
    handleDrop,
    existingAndNewComponent,
    handleCancelUpload,
    handleImportComponent,
  };
};

export default useComponentUploader;
