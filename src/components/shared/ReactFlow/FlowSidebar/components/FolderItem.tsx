import { ChevronDown, ChevronRight } from "lucide-react";
import {
  type ComponentProps,
  isValidElement,
  type MouseEvent,
  useState,
} from "react";

import { Icon } from "@/components/ui/icon";
import { InlineStack } from "@/components/ui/layout";
import { cn } from "@/lib/utils";
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
        className="flex items-center px-4 py-1 cursor-pointer hover:bg-muted"
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

export default FolderItem;
