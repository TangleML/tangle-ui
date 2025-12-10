import { ChevronDown, ChevronRight } from "lucide-react";
import {
  type ComponentProps,
  isValidElement,
  type MouseEvent,
  useState,
} from "react";

import { withSuspenseWrapper } from "@/components/shared/SuspenseWrapper";
import { Icon } from "@/components/ui/icon";
import { BlockStack, InlineStack } from "@/components/ui/layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { Library } from "@/providers/ComponentLibraryProvider/libraries/types";
import { useLibraryComponents } from "@/providers/ComponentLibraryProvider/useLibraryComponents";
import type { UIComponentFolder } from "@/types/componentLibrary";
import { isDisplayableComponentReference } from "@/utils/componentSpec";

import { ComponentItemFromUrl, ComponentMarkup } from "./ComponentItem";

type FolderItemProps = {
  folder: UIComponentFolder;
  icon?: ComponentProps<typeof Icon>["name"];
};

const FolderItem = ({ folder, icon }: FolderItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasComponents = folder.components && folder.components.length > 0;
  const hasSubfolders = folder.folders && folder.folders.length > 0;

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const chevronStyles = "h-4 w-4 text-gray-400 shrink-0";

  return (
    <div className="w-full" data-folder-name={folder.name}>
      <div
        className="flex items-center px-4 py-1 cursor-pointer hover:bg-gray-100"
        onClick={toggle}
        role="button"
        aria-expanded={isOpen}
        aria-label={`Folder: ${folder.name}`}
      >
        <InlineStack className={cn("relative", "mr-2")}>
          <Icon name={icon ? icon : "Folder"} className={chevronStyles} />
        </InlineStack>
        <span className="truncate text-sm font-medium">{folder.name}</span>
        <div className="ml-auto">
          {isOpen ? (
            <ChevronDown className={chevronStyles} />
          ) : (
            <ChevronRight className={chevronStyles} />
          )}
        </div>
      </div>

      {isOpen && (
        <div className="pl-3">
          {hasComponents && folder.components && (
            <div>
              {folder.components.map((component, idx) => {
                // If the component is a valid React element, render it directly (for special folders)
                if (isValidElement(component)) {
                  return component;
                }
                const key = `${folder.name}-component-${component.digest ?? component?.spec?.name ?? component.url ?? idx}`;
                // If the component has a spec render the component, otherwise, render using URL
                if (isDisplayableComponentReference(component)) {
                  return <ComponentMarkup key={key} component={component} />;
                }
                return (
                  <ComponentItemFromUrl key={key} componentRef={component} />
                );
              })}
            </div>
          )}
          {hasSubfolders && folder.folders && (
            <div>
              {folder.folders.map((subfolder, index) => (
                <FolderItem
                  key={`${folder.name}-folder-${index}`}
                  folder={subfolder}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FolderSkeleton = () => {
  const chevronStyles = "h-4 w-4 text-gray-400 shrink-0";

  return (
    <BlockStack className="w-full">
      <InlineStack
        className="px-4 py-1 cursor-pointer hover:bg-gray-100 w-full"
        align="space-between"
        wrap="nowrap"
      >
        <InlineStack className="mr-2" gap="2">
          <Spinner />
          <Skeleton size="lg" color="dark" />
        </InlineStack>

        <InlineStack className="ml-auto shrink-0">
          <Icon name="ChevronRight" className={chevronStyles} />
        </InlineStack>
      </InlineStack>
    </BlockStack>
  );
};

export const LibraryFolderItem = withSuspenseWrapper(
  ({
    library,
    ...rest
  }: Omit<FolderItemProps, "folder"> & { library: Library }) => {
    const folder = useLibraryComponents(library);

    if (
      (!folder.components || folder.components.length === 0) &&
      (!folder.folders || folder.folders.length === 0)
    ) {
      return null;
    }

    return <FolderItem {...rest} folder={folder} />;
  },
  FolderSkeleton,
);

export default FolderItem;
